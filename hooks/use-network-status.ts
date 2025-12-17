/**
 * 네트워크 상태 감지 훅
 * 온라인/오프라인 상태 변화를 실시간으로 감지
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
  });

  useEffect(() => {
    // 초기 상태 가져오기
    NetInfo.fetch().then((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isWifi: state.type === 'wifi',
        isCellular: state.type === 'cellular',
      });
    });

    // 네트워크 상태 변화 구독
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isWifi: state.type === 'wifi',
        isCellular: state.type === 'cellular',
      });
    });

    return () => unsubscribe();
  }, []);

  return status;
}

// 단순히 온라인 여부만 필요할 때
export function useIsOnline() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  
  // isInternetReachable이 null이면 isConnected만 사용
  if (isInternetReachable === null) {
    return isConnected !== false;
  }
  
  return isConnected === true && isInternetReachable === true;
}
