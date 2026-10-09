import { EmergenciesApi } from '../src/api/emergencies';

describe('Emergency Operations & API Integration Tests', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  test('createEmergency submits validated incident with coordinates and returns persisted record', async () => {
    const mockEmergency = {
      id: 'em-1234-abcd',
      created_by_id: 'user-paramedic-1',
      severity_level: 'CRITICAL',
      status: 'CREATED',
      location_description: 'Route 9 Mile Marker 14',
      latitude: 13.0827,
      longitude: 80.2707,
      assigned_ambulance_id: 'amb-1',
      required_capabilities: ['trauma_center'],
      patient_info: { chief_complaint: 'Crushing chest pain' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockEmergency,
    });

    const result = await EmergenciesApi.createEmergency({
      severity_level: 'CRITICAL',
      location_description: 'Route 9 Mile Marker 14',
      latitude: 13.0827,
      longitude: 80.2707,
      patient_info: { chief_complaint: 'Crushing chest pain' },
    });

    expect(result.id).toBe('em-1234-abcd');
    expect(result.severity_level).toBe('CRITICAL');
    expect(result.status).toBe('CREATED');
  });

  test('updateStatus transitions mission lifecycle', async () => {
    const transitioned = {
      id: 'em-1234-abcd',
      status: 'EN_ROUTE_SCENE',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => transitioned,
    });

    const res = await EmergenciesApi.updateStatus('em-1234-abcd', 'EN_ROUTE_SCENE', 'En route now');
    expect(res.status).toBe('EN_ROUTE_SCENE');
  });

  test('getHistory retrieves full audit log entries', async () => {
    const mockHistory = [
      {
        id: 'hist-1',
        emergency_id: 'em-1234-abcd',
        from_status: 'CREATED',
        to_status: 'EN_ROUTE_SCENE',
        created_at: new Date().toISOString(),
      },
      {
        id: 'hist-2',
        emergency_id: 'em-1234-abcd',
        from_status: 'EN_ROUTE_SCENE',
        to_status: 'ON_SCENE',
        created_at: new Date().toISOString(),
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockHistory,
    });

    const history = await EmergenciesApi.getHistory('em-1234-abcd');
    expect(history.length).toBe(2);
    expect(history[0].to_status).toBe('EN_ROUTE_SCENE');
    expect(history[1].to_status).toBe('ON_SCENE');
  });
});
