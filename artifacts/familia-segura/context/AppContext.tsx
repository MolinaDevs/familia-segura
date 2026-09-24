import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { 
  useGetFamilyOverview, 
  useUpdateAppRule, 
  useUpdateRoutine, 
  AppRuleStatus,
  AppRuleUpdateStatus
} from '@workspace/api-client-react';
import { useAuth } from '@clerk/expo';
import { getGetFamilyOverviewQueryKey } from '@workspace/api-client-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { Alert } from 'react-native';

export type AppStatus = 'permitido' | 'atenção' | 'bloqueado';

export type TrackedApp = {
  id: string;
  name: string;
  category: string;
  icon: string;
  iconColor: string;
  usageToday: number;
  dailyLimit: number;
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
};

type FamilyData = {
  childId?: string;
  guardianName: string;
  childName: string;
  childAge: number;
  apps: TrackedApp[];
  routines: Routine[];
  devices: any[];
  timeRequests: any[];
  lastSynced: string;
};

const STORAGE_KEY = '@familia-segura/data';

const initialData: FamilyData = {
  guardianName: '',
  childName: 'Criança',
  childAge: 10,
  lastSynced: 'Nunca',
  apps: [],
  routines: [],
  devices: [],
  timeRequests: [],
};

type AppContextValue = {
  data: FamilyData;
  isLoading: boolean;
  isOffline: boolean;
  totalUsage: number;
  usagePercent: number;
  toggleApp: (id: string) => void;
  setAppLimit: (id: string, minutes: number) => void;
  addExtraTime: (id: string, minutes: number) => void;
  toggleRoutine: (id: string) => void;
  refetch: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const showError = () => Alert.alert('Erro', 'Ação não pôde ser completada. Verifique sua conexão.');
const showPremiumRequired = () => Alert.alert(
  'Recurso Premium',
  'Assine o Família Segura Premium em Configurações para alterar limites, bloqueios e rotinas. As proteções já configuradas continuam ativas.',
);

function mapApiToData(apiData: any): FamilyData {
  if (!apiData) return initialData;
  const child = apiData.children?.[0] || { displayName: 'Criança', birthYear: 2014 };
  
  const mappedApps = (apiData.apps || []).map((app: any) => ({
    id: app.appId,
    name: app.appName,
    category: app.category,
    icon: app.icon,
    iconColor: app.iconColor,
    usageToday: app.usageTodayMinutes,
    dailyLimit: app.dailyLimitMinutes,
    status: app.status === AppRuleStatus.blocked ? 'bloqueado' : app.status === AppRuleStatus.attention ? 'atenção' : 'permitido'
  }));
  
  const mappedRoutines = (apiData.routines || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    days: r.days,
    start: r.startTime,
    end: r.endTime,
    enabled: r.enabled,
    icon: r.icon,
  }));
  
  return {
    childId: child.id,
    guardianName: apiData.members?.find((member: { role: string }) => member.role === 'owner')?.displayName ?? '',
    childName: child.displayName,
    childAge: child.birthYear ? new Date().getFullYear() - child.birthYear : 10,
    apps: mappedApps,
    routines: mappedRoutines,
    devices: apiData.devices || [],
    timeRequests: apiData.timeRequests || [],
    lastSynced: 'Agora',
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const { isSignedIn, userId } = useAuth();
  const { hasPremiumAccess } = useSubscription();
  const [localData, setLocalData] = useState<FamilyData | null>(null);
  
  const storageKey = `@familia-segura/data_${userId || 'guest'}`;

  const { data: apiData, isLoading: apiLoading, isError, refetch } = useGetFamilyOverview({
    query: {
      queryKey: getGetFamilyOverviewQueryKey(),
      enabled: !!isSignedIn,
      staleTime: 30000,
    }
  });

  const updateAppRule = useUpdateAppRule();
  const updateRoutine = useUpdateRoutine();

  useEffect(() => {
    setLocalData(null);
  }, [userId]);

  useEffect(() => {
    if (apiData && userId) {
      const mapped = mapApiToData(apiData);
      setLocalData(mapped);
      AsyncStorage.setItem(storageKey, JSON.stringify(mapped)).catch(() => {});
    }
  }, [apiData, storageKey, userId]);

  useEffect(() => {
    if (!apiData && isSignedIn) {
      AsyncStorage.getItem(storageKey)
        .then((stored) => {
          if (stored) {
            setLocalData(JSON.parse(stored) as FamilyData);
          } else {
            setLocalData(initialData);
          }
        })
        .catch(() => undefined);
    }
  }, [apiData, isSignedIn, storageKey]);

  const activeData = apiData ? mapApiToData(apiData) : localData || initialData;

  const toggleApp = useCallback((id: string) => {
    if (!hasPremiumAccess) { showPremiumRequired(); return; }
    if (isError) { showError(); return; } // Disallow writes if offline
    const app = activeData.apps.find(a => a.id === id);
    if (!app) return;
    const newStatus = app.status === 'bloqueado' ? AppRuleUpdateStatus.allowed : AppRuleUpdateStatus.blocked;
    
    updateAppRule.mutate({
      appId: id,
      data: { childId: activeData.childId!, status: newStatus }
    }, {
      onSuccess: () => refetch(),
      onError: showError,
    });
  }, [activeData, updateAppRule, refetch, isError, hasPremiumAccess]);

  const setAppLimit = useCallback((id: string, minutes: number) => {
    if (!hasPremiumAccess) { showPremiumRequired(); return; }
    if (isError) { showError(); return; } // Disallow writes if offline
    const newStatus = minutes === 0 ? AppRuleUpdateStatus.blocked : AppRuleUpdateStatus.allowed;
    
    updateAppRule.mutate({
      appId: id,
      data: { childId: activeData.childId!, dailyLimitMinutes: minutes, status: newStatus }
    }, {
      onSuccess: () => refetch(),
      onError: showError,
    });
  }, [activeData.childId, updateAppRule, refetch, isError, hasPremiumAccess]);

  const addExtraTime = useCallback((id: string, minutes: number) => {
    if (isError) { showError(); return; } // Disallow writes if offline
    const app = activeData.apps.find(a => a.id === id);
    if (!app) return;
    const newLimit = (app.dailyLimit || 0) + minutes;
    
    updateAppRule.mutate({
      appId: id,
      data: { childId: activeData.childId!, dailyLimitMinutes: newLimit, status: AppRuleUpdateStatus.allowed }
    }, {
      onSuccess: () => refetch(),
      onError: showError,
    });
  }, [activeData, updateAppRule, refetch, isError]);

  const toggleRoutine = useCallback((id: string) => {
    if (!hasPremiumAccess) { showPremiumRequired(); return; }
    if (isError) { showError(); return; } // Disallow writes if offline
    const routine = activeData.routines.find(r => r.id === id);
    if (!routine) return;
    
    updateRoutine.mutate({
      routineId: id,
      data: { enabled: !routine.enabled }
    }, {
      onSuccess: () => refetch(),
      onError: showError,
    });
  }, [activeData, updateRoutine, refetch, isError, hasPremiumAccess]);

  const totalUsage = activeData.apps.reduce((sum, app) => sum + app.usageToday, 0);
  const totalLimit = activeData.apps.reduce((sum, app) => sum + app.dailyLimit, 0);
  
  const value = useMemo(() => ({
    data: activeData,
    isLoading: apiLoading && !localData,
    isOffline: isError,
    totalUsage,
    usagePercent: totalLimit ? Math.min(100, Math.round((totalUsage / totalLimit) * 100)) : 0,
    toggleApp,
    setAppLimit,
    addExtraTime,
    toggleRoutine,
    refetch,
  }), [activeData, apiLoading, localData, isError, totalUsage, totalLimit, toggleApp, setAppLimit, addExtraTime, toggleRoutine, refetch]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useFamily() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useFamily precisa estar dentro de AppProvider');
  }
  return context;
}