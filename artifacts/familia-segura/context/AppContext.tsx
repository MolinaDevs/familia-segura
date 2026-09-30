import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  useGetFamilyOverview,
  useUpdateAppRule,
  useUpdateRoutine,
  useCreateTimeGrant,
  AppRuleStatus,
  AppRuleUpdateStatus,
  getGetFamilyOverviewQueryKey,
  type FamilyOverview,
  type ChildProfile,
  type Device,
  type DeviceApp,
  type DeviceEvent,
  type FamilyLimits,
  type TimeRequest,
} from '@workspace/api-client-react';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { apiStatus, showApiError } from '@/lib/apiErrors';
import { forgetSessionData } from '@/lib/session';

export type AppStatus = 'permitido' | 'atenção' | 'bloqueado';

export type TrackedApp = {
  id: string;
  ruleId: string;
  name: string;
  category: string;
  icon: string;
  iconColor: string;
  usageToday: number;
  dailyLimit: number;
  extraToday: number;
  effectiveLimit: number;
  status: AppStatus;
};

export type Routine = {
  id: string;
  title: string;
  description: string;
  days: string;
  start: string;
  end: string;
  enabled: boolean;
  icon: string;
  /** Android: trava a tela durante a rotina. */
  lockScreen: boolean;
};

export type Role = 'owner' | 'guardian' | 'viewer';

type FamilyData = {
  childId?: string;
  guardianName: string;
  childName: string;
  childAge: number;
  childColor: string;
  children: ChildProfile[];
  apps: TrackedApp[];
  routines: Routine[];
  /** Aparelhos da criança selecionada. */
  devices: Device[];
  allDevices: Device[];
  timeRequests: TimeRequest[];
  pendingApps: DeviceApp[];
  recentEvents: DeviceEvent[];
  limits?: FamilyLimits;
  role: Role;
  today?: string;
  lastSynced: string;
};

const emptyData: FamilyData = {
  guardianName: '',
  childName: 'Criança',
  childAge: 10,
  childColor: '#1C5A96',
  children: [],
  lastSynced: 'Nunca',
  apps: [],
  routines: [],
  devices: [],
  allDevices: [],
  timeRequests: [],
  pendingApps: [],
  recentEvents: [],
  role: 'viewer',
};

type AppContextValue = {
  data: FamilyData;
  overview?: FamilyOverview;
  isLoading: boolean;
  isOffline: boolean;
  canEdit: boolean;
  totalUsage: number;
  usagePercent: number;
  selectChild: (childId: string) => void;
  toggleApp: (id: string) => void;
  setAppLimit: (id: string, minutes: number) => void;
  addExtraTime: (id: string, minutes: number) => void;
  toggleRoutine: (id: string) => void;
  refetch: () => void;
};

/** Aumentar quando o formato de FamilyOverview mudar de um jeito que telas antigas não entendam. */
const CACHE_VERSION = 2;

const AppContext = createContext<AppContextValue | null>(null);

const statusLabel = (status: string): AppStatus =>
  status === AppRuleStatus.blocked ? 'bloqueado' : status === AppRuleStatus.attention ? 'atenção' : 'permitido';

function mapOverview(overview: FamilyOverview | undefined, selectedChildId: string | null): FamilyData {
  if (!overview) return emptyData;
  const child = overview.children.find((c) => c.id === selectedChildId) ?? overview.children[0];
  const me = overview.members.find((m) => m.isCurrentUser);
  const owner = overview.members.find((m) => m.role === 'owner');
  const childId = child?.id;
  return {
    childId,
    guardianName: me?.displayName ?? owner?.displayName ?? '',
    childName: child?.displayName ?? 'Criança',
    childAge: child ? new Date().getFullYear() - child.birthYear : 10,
    childColor: child?.color ?? '#1C5A96',
    children: overview.children,
    apps: overview.apps.filter((a) => a.childId === childId).map((app) => ({
      id: app.appId,
      ruleId: app.id,
      name: app.appName,
      category: app.category,
      icon: app.icon,
      iconColor: app.iconColor,
      usageToday: app.usageTodayMinutes,
      dailyLimit: app.dailyLimitMinutes,
      extraToday: app.extraTodayMinutes,
      effectiveLimit: app.effectiveLimitMinutes,
      // "Atenção" quando já usou 80% do limite de hoje (o status salvo continua "permitido").
      status: app.status === AppRuleStatus.allowed && app.effectiveLimitMinutes > 0 && app.usageTodayMinutes >= app.effectiveLimitMinutes * 0.8
        ? 'atenção'
        : statusLabel(app.status),
    })),
    routines: overview.routines.filter((r) => r.childId === childId).map((r) => ({
      id: r.id, title: r.title, description: r.description, days: r.days, start: r.startTime, end: r.endTime, enabled: r.enabled, icon: r.icon, lockScreen: r.lockScreen,
    })),
    devices: overview.devices.filter((d) => d.childId === childId),
    allDevices: overview.devices,
    timeRequests: overview.timeRequests,
    pendingApps: overview.pendingApps,
    recentEvents: overview.recentEvents,
    limits: overview.limits,
    role: (me?.role ?? 'viewer') as Role,
    today: overview.today,
    lastSynced: 'Agora',
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const { isSignedIn, userId } = useAuth();
  const [cached, setCached] = useState<FamilyOverview | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Versão no nome: depois de uma atualização do app, cache com formato antigo é ignorado (não quebra telas).
  const cacheKey = `@familia-segura/overview_v${CACHE_VERSION}_${userId || 'guest'}`;
  const selectionKey = `@familia-segura/selected-child_${userId || 'guest'}`;

  const { data: apiData, isLoading: apiLoading, isError, error, refetch } = useGetFamilyOverview({
    query: {
      queryKey: getGetFamilyOverviewQueryKey(),
      enabled: !!isSignedIn,
      staleTime: 30000,
      refetchInterval: 60_000,
    },
  });

  const updateAppRule = useUpdateAppRule();
  const updateRoutine = useUpdateRoutine();
  const createGrant = useCreateTimeGrant();

  useEffect(() => {
    setCached(null);
    setSelectedChildId(null);
    if (!isSignedIn) return;
    AsyncStorage.multiGet([cacheKey, selectionKey])
      .then(([[, overview], [, selection]]) => {
        if (overview) setCached(JSON.parse(overview) as FamilyOverview);
        if (selection) setSelectedChildId(selection);
      })
      .catch(() => undefined);
  }, [cacheKey, selectionKey, isSignedIn]);

  useEffect(() => {
    if (apiData && userId) AsyncStorage.setItem(cacheKey, JSON.stringify(apiData)).catch(() => undefined);
  }, [apiData, cacheKey, userId]);

  // 404 = a pessoa não participa mais da família (removida, família excluída): some o cache e volta à entrada.
  // Só conta como "perdeu o vínculo" quem já tinha família aqui (no cadastro inicial o 404 é o normal).
  const status = isError ? apiStatus(error) : undefined;
  const hadFamily = useRef(false);
  if (apiData || cached) hadFamily.current = true;
  const membershipLost = status === 404;
  useEffect(() => {
    if (!membershipLost || !hadFamily.current) return;
    hadFamily.current = false;
    setCached(null);
    void forgetSessionData();
    router.replace('/(app)');
  }, [membershipLost]);

  const overview = membershipLost ? undefined : apiData ?? cached ?? undefined;
  const data = useMemo(() => mapOverview(overview, selectedChildId), [overview, selectedChildId]);
  const canEdit = data.role !== 'viewer';

  const selectChild = useCallback((childId: string) => {
    setSelectedChildId(childId);
    AsyncStorage.setItem(selectionKey, childId).catch(() => undefined);
  }, [selectionKey]);

  // "Sem conexão" só quando o problema é de rede/servidor; 4xx não é falta de internet.
  const isOffline = isError && (status === undefined || status >= 500);

  const guard = useCallback(() => {
    if (isOffline) { showApiError(null); return false; }
    if (!canEdit) { showApiError({ status: 403 }); return false; }
    if (!data.childId) return false;
    return true;
  }, [isOffline, canEdit, data.childId]);

  const onDone = useMemo(() => ({ onSuccess: () => void refetch(), onError: (error: unknown) => showApiError(error) }), [refetch]);

  // Toque duplo não manda duas alterações opostas (a segunda desfaria a primeira com o estado antigo).
  const toggleApp = useCallback((id: string) => {
    if (updateAppRule.isPending || !guard()) return;
    const app = data.apps.find((a) => a.id === id);
    if (!app) return;
    const status = app.status === 'bloqueado' ? AppRuleUpdateStatus.allowed : AppRuleUpdateStatus.blocked;
    updateAppRule.mutate({ appId: id, data: { childId: data.childId!, status } }, onDone);
  }, [guard, data.apps, data.childId, updateAppRule, onDone]);

  const setAppLimit = useCallback((id: string, minutes: number) => {
    if (!guard()) return;
    const status = minutes === 0 ? AppRuleUpdateStatus.blocked : AppRuleUpdateStatus.allowed;
    updateAppRule.mutate({ appId: id, data: { childId: data.childId!, dailyLimitMinutes: minutes, status } }, onDone);
  }, [guard, data.childId, updateAppRule, onDone]);

  /** Tempo extra só para hoje (não muda o limite diário). */
  const addExtraTime = useCallback((id: string, minutes: number) => {
    if (!guard()) return;
    createGrant.mutate({ childId: data.childId!, data: { appId: id, minutes } }, onDone);
  }, [guard, data.childId, createGrant, onDone]);

  const toggleRoutine = useCallback((id: string) => {
    if (updateRoutine.isPending || !guard()) return;
    const routine = data.routines.find((r) => r.id === id);
    if (!routine) return;
    updateRoutine.mutate({ routineId: id, data: { enabled: !routine.enabled } }, onDone);
  }, [guard, data.routines, updateRoutine, onDone]);

  const totalUsage = data.apps.reduce((sum, app) => sum + app.usageToday, 0);
  const totalLimit = data.apps.filter((a) => a.status !== 'bloqueado').reduce((sum, app) => sum + app.effectiveLimit, 0);

  const value = useMemo<AppContextValue>(() => ({
    data,
    overview,
    isLoading: apiLoading && !cached,
    isOffline,
    canEdit,
    totalUsage,
    usagePercent: totalLimit ? Math.min(100, Math.round((totalUsage / totalLimit) * 100)) : 0,
    selectChild,
    toggleApp,
    setAppLimit,
    addExtraTime,
    toggleRoutine,
    refetch: () => void refetch(),
  }), [data, overview, apiLoading, cached, isOffline, canEdit, totalUsage, totalLimit, selectChild, toggleApp, setAppLimit, addExtraTime, toggleRoutine, refetch]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useFamily() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useFamily precisa estar dentro de AppProvider');
  }
  return context;
}
