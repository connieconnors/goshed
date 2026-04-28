import { CapacitorConfig } from '@capacitor/cli';

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
