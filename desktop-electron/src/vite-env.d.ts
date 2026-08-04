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
}
