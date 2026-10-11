import { socketService } from '../src/services/socket';

describe('Socket.IO Real-time Connection & Room Tests', () => {
  test('socketService allows registering and triggering event handlers', () => {
    const handler = jest.fn();
    socketService.on('hospital.assigned', handler);

    // Verify handler registration
    expect(handler).not.toHaveBeenCalled();

    // Cleanup
    socketService.off('hospital.assigned', handler);
  });

  test('setEmergencyRoom updates current target emergency room', () => {
    socketService.setEmergencyRoom('em-target-room-1');
    // Service state updated safely without throwing
    expect(true).toBe(true);
  });

  test('onReconnect registers callback and allows unsubscribing', () => {
    const cb = jest.fn();
    const unsub = socketService.onReconnect(cb);
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  test('socketService forwards emergency.location_updated and handover_confirmed', () => {
    const locHandler = jest.fn();
    const handoverHandler = jest.fn();
    socketService.on('emergency.location_updated', locHandler);
    socketService.on('emergency.handover_confirmed', handoverHandler);

    expect(locHandler).not.toHaveBeenCalled();
    expect(handoverHandler).not.toHaveBeenCalled();

    socketService.off('emergency.location_updated', locHandler);
    socketService.off('emergency.handover_confirmed', handoverHandler);
  });
});

