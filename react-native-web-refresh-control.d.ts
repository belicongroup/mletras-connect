declare module 'react-native-web-refresh-control' {
  import type { ColorValue } from 'react-native';

  export interface PatchFlatListOptions {
    tintColor?: ColorValue;
    colors?: ColorValue[];
    enabled?: boolean;
  }

  export function patchFlatListProps(options?: PatchFlatListOptions): void;
}
