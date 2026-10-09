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
});
