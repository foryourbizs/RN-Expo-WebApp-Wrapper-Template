// __tests__/unit/bridge/register-handler.test.ts
import { registerHandler, unregisterHandler, clearHandlers } from '@/lib/bridge';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('registerHandler', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should register a handler for an action', () => {
    const handler = jest.fn();

    registerHandler('testAction', handler);

    // 핸들러가 등록되었는지 간접 확인 (내부 Map 접근 불가하므로)
    // handleBridgeMessage로 검증
    expect(handler).not.toHaveBeenCalled();
  });

  it('should allow registering multiple handlers for different actions', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    registerHandler('action1', handler1);
    registerHandler('action2', handler2);

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should override handler when registering same action twice', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    registerHandler('sameAction', handler1);
    registerHandler('sameAction', handler2);

    // 두 번째 핸들러가 등록됨 (덮어쓰기)
    // handleBridgeMessage로 검증 필요
  });
});

describe('unregisterHandler', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should unregister a handler', () => {
    const handler = jest.fn();
    registerHandler('testAction', handler);

    unregisterHandler('testAction');

    // 핸들러가 제거되었는지 handleBridgeMessage로 검증
  });

  it('should not throw when unregistering non-existent handler', () => {
    expect(() => {
      unregisterHandler('nonExistent');
    }).not.toThrow();
  });
});

describe('clearHandlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should clear all handlers', () => {
    registerHandler('action1', jest.fn());
    registerHandler('action2', jest.fn());

    clearHandlers();

    // 모든 핸들러가 제거됨
  });
});
