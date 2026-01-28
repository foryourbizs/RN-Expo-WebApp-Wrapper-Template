// __tests__/mocks/webview.ts
export const createMockWebView = () => {
  const injectedScripts: string[] = [];

  return {
    injectJavaScript: jest.fn((script: string) => {
      injectedScripts.push(script);
    }),
    reload: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    stopLoading: jest.fn(),
    // 테스트용 헬퍼
    _getInjectedScripts: () => injectedScripts,
    _clearInjectedScripts: () => { injectedScripts.length = 0; },
  };
};

export type MockWebView = ReturnType<typeof createMockWebView>;
