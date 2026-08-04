export interface ThermostatSnapshot {
  currentTemperatureCelsius?: number | null;
  setPointCelsius?: number | null;
  hvacMode?: string | null;
  hvacAction?: string | null;
  fanMode?: string | null;
  updatedAt?: string | null;
}

export interface RuntimeSnapshot {
  todayHours?: number | null;
  monthHours?: number | null;
  lifetimeHours?: number | null;
  estimatedCostEnabled?: boolean;
  estimatedCostTodayDollars?: number | null;
  estimatedCostMonthDollars?: number | null;
  estimatedCostLifetimeDollars?: number | null;
}

export interface DefenderEvent { timestamp?: string; level?: string; message?: string; }

export interface DefenderSnapshot {
  targetTemperatureCelsius?: number | null;
  defenderEnabled?: boolean;
  connectionState?: string | null;
  homeAssistantThermostat?: ThermostatSnapshot | null;
  nextAction?: string | null;
  lastError?: string | null;
  acRuntime?: RuntimeSnapshot | null;
  events?: DefenderEvent[];
  [key: string]: unknown;
}

export interface NotificationItem {
  id?: string;
  timestamp?: string;
  level?: string;
  title?: string;
  message?: string;
  read?: boolean;
  dismissed?: boolean;
}

export interface NotificationSnapshot {
  notifications?: NotificationItem[];
  unreadCount?: number;
  activeCount?: number;
  [key: string]: unknown;
}
