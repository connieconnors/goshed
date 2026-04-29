type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    url?: string;
    cleartext?: boolean;
  };
};

const config: CapacitorConfig = {
  appId: 'com.thriftshopperinc.goshed',
  appName: 'GoShed',
  webDir: 'out',
  server: {
    url: 'https://goshed.app',
    cleartext: false
  }
};

export default config;
