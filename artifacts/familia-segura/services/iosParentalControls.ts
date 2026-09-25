import { Platform } from 'react-native';
import type { AppRule, Routine } from '@workspace/api-client-react';

type NativeControls = typeof import('react-native-device-activity');

export type NativeControlState =
  | 'unsupported'
  | 'native-build-required'
  | 'not-determined'
  | 'denied'
  | 'approved'
  | 'error';

export type NativePolicyResult = {
  configuredRules: number;
  configuredRoutines: number;
  skippedRules: number;
};

let modulePromise: Promise<NativeControls | null> | null = null;

export async function loadNativeControls(): Promise<NativeControls | null> {
  if (Platform.OS !== 'ios') return null;
  if (!modulePromise) {
    modulePromise = import('react-native-device-activity')
      .then((module) => module.isAvailable() ? module : null)
      .catch(() => null);
  }
  return modulePromise;
}

export async function getNativeControlState(): Promise<NativeControlState> {
  if (Platform.OS !== 'ios') return 'unsupported';
  const native = await loadNativeControls();
  if (!native) return 'native-build-required';
  const status = native.getAuthorizationStatus();
  if (status === native.AuthorizationStatus.approved) return 'approved';
  if (status === native.AuthorizationStatus.denied) return 'denied';
  return 'not-determined';
}

export async function requestNativeControlAuthorization(): Promise<NativeControlState> {
  const native = await loadNativeControls();
  if (!native) return Platform.OS === 'ios' ? 'native-build-required' : 'unsupported';
  try {
    await native.requestAuthorization('child');
    return getNativeControlState();
  } catch {
    return 'error';
  }
}

export const selectionIdForRule = (ruleId: string) => `familia-segura-rule-${ruleId}`;

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
/** Minutos que ainda restam neste aparelho: o limite é da criança e desconta o uso nos outros aparelhos. */
const remainingMinutes = (rule: AppRule) => rule.dailyLimitMinutes - (rule.otherDevicesUsageMinutes ?? 0);
// O nome segue o limite (muda só com tempo extra, quando desbloquear é o esperado); o gatilho usa o tempo restante.
// Assim o registro de "limite atingido hoje" sobrevive às sincronizações.
const activityNameForRule = (rule: AppRule) =>
  `fs-limit-${safeName(rule.id)}-${Math.max(1, rule.dailyLimitMinutes)}-${selectionIdForRule(rule.id)}`;

function timeParts(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0, second: 0 };
}

const weekdayBySlug: Record<string, number> = {
  dom: 1,
  seg: 2,
  ter: 3,
  qua: 4,
  qui: 5,
  sex: 6,
  sab: 7,
  sáb: 7,
};

function routineWeekdays(days: string): number[] {
  const parsed = days
    .toLocaleLowerCase('pt-BR')
    .split(',')
    .map((day) => weekdayBySlug[day.trim()])
    .filter((day): day is number => Boolean(day));
  return parsed.length > 0 ? [...new Set(parsed)] : [1, 2, 3, 4, 5, 6, 7];
}

function isEventFromToday(lastCalledAt: Date) {
  const now = new Date();
  return lastCalledAt.getFullYear() === now.getFullYear()
    && lastCalledAt.getMonth() === now.getMonth()
    && lastCalledAt.getDate() === now.getDate();
}

type WeeklyWindow = { start: number; end: number };

function mergedRoutineWindows(routines: Routine[]): WeeklyWindow[] {
  const weekMinutes = 7 * 24 * 60;
  const windows: WeeklyWindow[] = [];
  for (const routine of routines.filter((item) => item.enabled)) {
    const start = timeParts(routine.startTime);
    const end = timeParts(routine.endTime);
    const startMinute = start.hour * 60 + start.minute;
    const endMinute = end.hour * 60 + end.minute;
    const duration = endMinute > startMinute
      ? endMinute - startMinute
      : 24 * 60 - startMinute + endMinute;
    for (const weekday of routineWeekdays(routine.days)) {
      const absoluteStart = (weekday - 1) * 24 * 60 + startMinute;
      const absoluteEnd = absoluteStart + duration;
      if (absoluteEnd <= weekMinutes) {
        windows.push({ start: absoluteStart, end: absoluteEnd });
      } else {
        windows.push({ start: absoluteStart, end: weekMinutes });
        windows.push({ start: 0, end: absoluteEnd - weekMinutes });
      }
    }
  }

  const merged: WeeklyWindow[] = [];
  for (const window of windows.sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && window.start <= previous.end) {
      previous.end = Math.max(previous.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }
  if (merged.length === 1 && merged[0].start === 0 && merged[0].end === weekMinutes) {
    return Array.from({ length: 7 }, (_, day) => ({ start: day * 1440, end: (day + 1) * 1440 }));
  }
  return merged;
}

function weeklyMinuteParts(value: number) {
  const normalized = value === 7 * 24 * 60 ? 0 : value;
  const day = Math.floor(normalized / (24 * 60));
  const minuteOfDay = normalized % (24 * 60);
  return {
    weekday: day + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    second: 0,
  };
}

function shieldFor(appName: string, limitMinutes: number) {
  return {
    title: 'Pausa combinada',
    subtitle: `${appName} chegou ao limite de ${limitMinutes} minutos. Você pode pedir mais tempo no Família Segura.`,
    primaryButtonLabel: 'Entendi',
    secondaryButtonLabel: 'Pedir mais tempo',
    iconSystemName: 'hourglass',
    backgroundColor: { red: 248, green: 247, blue: 243 },
    titleColor: { red: 23, green: 32, blue: 42 },
    subtitleColor: { red: 71, green: 80, blue: 78 },
    primaryButtonBackgroundColor: { red: 239, green: 107, blue: 91 },
    primaryButtonLabelColor: { red: 255, green: 255, blue: 255 },
    secondaryButtonLabelColor: { red: 30, green: 74, blue: 59 },
  };
}

function routineShield() {
  return {
    ...shieldFor('A rotina da família', 0),
    title: 'Horário de pausa',
    subtitle: 'Este período foi combinado com sua família. Abra o Família Segura para conferir a rotina ou pedir ajuda.',
  };
}

function usageEvents(selection: string, limitMinutes: number) {
  if (limitMinutes <= 1) return [];
  const step = Math.max(15, Math.ceil(limitMinutes / 19 / 5) * 5);
  const events = [];
  for (let threshold = step; threshold < limitMinutes; threshold += step) {
    events.push({
      eventName: `usage-${threshold}`,
      familyActivitySelection: selection,
      threshold: { minute: threshold },
      includesPastActivity: true,
    });
  }
  return events;
}

export async function applyNativePolicies(
  rules: AppRule[],
  routines: Routine[],
): Promise<NativePolicyResult> {
  const native = await loadNativeControls();
  if (!native || native.getAuthorizationStatus() !== native.AuthorizationStatus.approved) {
    return { configuredRules: 0, configuredRoutines: 0, skippedRules: rules.length };
  }

  native.stopMonitoring();
  native.resetBlocks('policy-sync');

  let configuredRules = 0;
  let configuredMonitors = 0;
  let skippedRules = 0;
  const recentEvents = native.getEvents().filter((event) => isEventFromToday(event.lastCalledAt));
  const maxRuleMonitors = 12;
  const monitorRules: Array<{ rule: AppRule; selectionId: string; selection: string; shieldId: string }> = [];

  for (const rule of rules) {
    const selectionId = selectionIdForRule(rule.id);
    const selection = native.getFamilyActivitySelectionId(selectionId);
    if (!selection) {
      skippedRules++;
      continue;
    }
    const shieldId = `shield-${safeName(rule.id)}`;
    native.updateShieldWithId(
      shieldFor(rule.appName, rule.dailyLimitMinutes),
      {
        primary: { behavior: 'close' },
        secondary: { behavior: 'defer', actions: [{ type: 'openApp' }] },
      },
      shieldId,
    );

    if (rule.status === 'blocked' || rule.dailyLimitMinutes === 0 || remainingMinutes(rule) <= 0) {
      native.blockSelection({ activitySelectionId: selectionId }, 'guardian-rule');
      configuredRules++;
      continue;
    }
    monitorRules.push({ rule, selectionId, selection, shieldId });
  }

  for (const { rule, selectionId, selection, shieldId } of monitorRules.slice(0, maxRuleMonitors)) {
    const activityName = activityNameForRule(rule);
    const eventName = 'daily-limit';
    const reachedToday = recentEvents.some((event) =>
      event.activityName === activityName
      && event.callbackName === 'eventDidReachThreshold'
      && event.eventName === eventName);
    if (reachedToday) {
      native.blockSelection({ activitySelectionId: selectionId }, 'daily-limit-reached');
    } else {
      native.unblockSelection({ activitySelectionId: selectionId }, 'policy-sync');
    }
    native.configureActions({
      activityName,
      callbackName: 'eventDidReachThreshold',
      eventName,
      actions: [{ type: 'blockSelection', familyActivitySelectionId: selectionId, shieldId }],
    });
    native.configureActions({
      activityName,
      callbackName: 'intervalDidStart',
      actions: [{ type: 'unblockSelection', familyActivitySelectionId: selectionId }],
    });
    await native.startMonitoring(
      activityName,
      {
        intervalStart: { hour: 0, minute: 0, second: 0 },
        intervalEnd: { hour: 23, minute: 59, second: 59 },
        repeats: true,
        warningTime: { minute: 5 },
      },
      [
        ...usageEvents(selection, Math.max(1, remainingMinutes(rule))),
        {
          eventName,
          familyActivitySelection: selection,
          threshold: { minute: Math.max(1, remainingMinutes(rule)) },
          includesPastActivity: true,
        },
      ],
    );
    configuredRules++;
    configuredMonitors++;
  }
  skippedRules += Math.max(0, monitorRules.length - maxRuleMonitors);

  const activeRoutines = routines.filter((routine) => routine.enabled);
  let remainingActivitySlots = Math.max(0, 20 - configuredMonitors);
  let configuredRoutines = 0;
  const routineWindows = mergedRoutineWindows(activeRoutines);
  const now = new Date();
  const currentWeekMinute = now.getDay() * 24 * 60 + now.getHours() * 60 + now.getMinutes();
  const orderedWindows = [...routineWindows].sort((a, b) => {
    const aActive = currentWeekMinute >= a.start && currentWeekMinute < a.end ? 1 : 0;
    const bActive = currentWeekMinute >= b.start && currentWeekMinute < b.end ? 1 : 0;
    return bActive - aActive || a.start - b.start;
  });
  const scheduledWindows = orderedWindows.slice(0, remainingActivitySlots);
  native.updateShield(
    routineShield(),
    {
      primary: { behavior: 'close' },
      secondary: { behavior: 'defer', actions: [{ type: 'openApp' }] },
    },
    'routine-policy-sync',
  );
  if (scheduledWindows.some((window) => currentWeekMinute >= window.start && currentWeekMinute < window.end)) {
    native.enableBlockAllMode('routine-active');
  } else {
    native.disableBlockAllMode('routine-inactive');
  }
  for (const [index, window] of scheduledWindows.entries()) {
    if (remainingActivitySlots === 0) break;
    const activityName = `fs-routine-window-${index}`;
    native.configureActions({
      activityName,
      callbackName: 'intervalDidStart',
      actions: [{ type: 'enableBlockAllMode' }],
    });
    native.configureActions({
      activityName,
      callbackName: 'intervalDidEnd',
      actions: [{ type: 'disableBlockAllMode' }],
    });
    await native.startMonitoring(
      activityName,
      {
        intervalStart: weeklyMinuteParts(window.start),
        intervalEnd: weeklyMinuteParts(window.end),
        repeats: true,
        warningTime: { minute: 5 },
      },
      [],
    );
    remainingActivitySlots--;
    configuredRoutines++;
  }

  return { configuredRules, configuredRoutines, skippedRules };
}

export async function getAllowedUsageSamples(rules: AppRule[]) {
  const native = await loadNativeControls();
  if (!native) return [];
  const events = native.getEvents();
  return rules.map((rule) => {
    const activityName = activityNameForRule(rule);
    const currentEvents = events.filter((event) =>
      event.activityName === activityName
      && event.callbackName === 'eventDidReachThreshold'
      && isEventFromToday(event.lastCalledAt));
    const reached = currentEvents.some((event) => event.eventName === 'daily-limit');
    const thresholdEstimate = currentEvents.reduce((highest, event) => {
      if (!event.eventName?.startsWith('usage-')) return highest;
      const value = Number(event.eventName.slice('usage-'.length));
      return Number.isFinite(value) ? Math.max(highest, value) : highest;
    }, 0);
    // Uso deste aparelho apenas (o servidor soma os aparelhos da criança).
    return {
      appId: rule.appId,
      usageTodayMinutes: reached ? Math.max(0, remainingMinutes(rule)) : thresholdEstimate,
    };
  });
}
/** Regras que já têm app/categoria escolhidos no seletor da Apple neste aparelho. */
export async function getBoundRuleIds(rules: AppRule[]): Promise<string[]> {
  const native = await loadNativeControls();
  if (!native) return [];
  return rules.filter((rule) => Boolean(native.getFamilyActivitySelectionId(selectionIdForRule(rule.id)))).map((rule) => rule.id);
}
