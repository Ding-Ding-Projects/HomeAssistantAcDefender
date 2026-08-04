interface Window {
  controller: ControllerBridge;
}

interface ControllerConfig {
  baseUrl: string;
  username: string;
  password: string;
  remember: boolean;
  language: "en" | "yue" | "bilingual";
  funnyEnglish: number;
  funnyCantonese: number;
  theme: "dark" | "light";
  density: "compact" | "comfortable";
  updateFeedUrl: string;
  activeTab: "dashboard" | "notifications" | "settings";
  tabOrder: Array<"dashboard" | "notifications" | "settings">;
  tabAppearance: Record<string, { foreground: string; background: string; fontSize: number }>;
}

interface ControllerBridge {
  loadConfig(): Promise<ControllerConfig>;
  saveConfig(values: Partial<ControllerConfig>): Promise<ControllerConfig>;
  connect(values: { baseUrl: string; username: string; password: string; remember: boolean }): Promise<DefenderSnapshot>;
  disconnect(): Promise<boolean>;
  status(): Promise<DefenderSnapshot>;
  notifications(query: { limit?: number; includeDismissed?: boolean }): Promise<NotificationSnapshot>;
  notificationAction(id: string, action: "read" | "dismiss" | "restore"): Promise<NotificationSnapshot>;
  target(temperature: number): Promise<DefenderSnapshot>;
  defender(enabled: boolean): Promise<DefenderSnapshot>;
  command(name: "forceTarget" | "forceBoost" | "refresh" | "thermostatOff"): Promise<DefenderSnapshot>;
  configureUpdater(feedUrl: string): Promise<{ configured: boolean; platform: string }>;
  checkForUpdate(): Promise<{ status: string }>;
  installUpdate(): Promise<boolean>;
  onUpdateReady(callback: (payload: { releaseName?: string; releaseNotes?: string }) => void): () => void;
  onUpdateError(callback: (payload: { message?: string }) => void): () => void;
}
