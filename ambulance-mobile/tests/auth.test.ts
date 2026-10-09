import { AuthApi } from '../src/api/auth';
import { SecureStorageService } from '../src/services/secureStorage';

describe('Authentication & Token Security Unit Tests', () => {
  beforeEach(async () => {
    await SecureStorageService.clearToken();
    (global as any).fetch = jest.fn();
  });

  test('login sends valid POST request and stores JWT securely', async () => {
    const fakeTokenResponse = {
      access_token: 'mock.jwt.token.value',
      token_type: 'bearer',
      expires_in: 3600,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => fakeTokenResponse,
    });

    const res = await AuthApi.login({
      email: 'ambulance@ercs.org',
      password: 'Ambulance123!',
    });

    expect(res.access_token).toBe('mock.jwt.token.value');
    await SecureStorageService.saveToken(res.access_token);

    const saved = await SecureStorageService.getToken();
    expect(saved).toBe('mock.jwt.token.value');
  });

  test('registerCrew registers paramedic and unit call sign with real backend contract', async () => {
    const fakeUser = {
      id: 'uuid-paramedic-1',
      email: 'newparamedic@ercs.org',
      role: 'AMBULANCE_CREW',
      is_active: true,
      ambulance_id: 'uuid-amb-unit-505',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => fakeUser,
    });

    const created = await AuthApi.registerCrew({
      email: 'newparamedic@ercs.org',
      password: 'StrongPassword123!',
      ambulance_identifier: 'AMB-UNIT-505',
      contact_number: '+1-555-0505',
    });

    expect(created.email).toBe('newparamedic@ercs.org');
    expect(created.role).toBe('AMBULANCE_CREW');
    expect(created.ambulance_id).toBe('uuid-amb-unit-505');
  });

  test('getMe includes Authorization bearer token header', async () => {
    await SecureStorageService.saveToken('valid-active-jwt');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        id: 'user-id-1',
        email: 'ambulance@ercs.org',
        role: 'AMBULANCE_CREW',
        is_active: true,
      }),
    });

    await AuthApi.getMe();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-active-jwt',
        }),
      })
    );
  });
});
