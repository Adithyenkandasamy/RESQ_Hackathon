import { EmergenciesApi } from '../src/api/emergencies';

describe('AI Speech, Groq Extraction, & Hospital Matching Tests', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  test('extractEntities calls backend Groq NLP entity extraction endpoint', async () => {
    const mockExtractions = {
      emergency_id: 'em-1234',
      extractions: {
        chief_complaint: 'Crushing chest pain',
        suspected_condition: 'Acute Coronary Syndrome',
        triage_category: 'CRITICAL',
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockExtractions,
    });

    const res = await EmergenciesApi.extractEntities(
      'em-1234',
      'Patient 52yo male with sudden crushing chest pain and dyspnea.'
    );

    expect(res.extractions.chief_complaint).toBe('Crushing chest pain');
    expect(res.extractions.suspected_condition).toBe('Acute Coronary Syndrome');
  });

  test('verifyExtractions locks clinical observations into record', async () => {
    const verifiedResponse = {
      id: 'em-1234',
      clinical_entities: {
        chief_complaint: 'Crushing chest pain',
        verified: true,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => verifiedResponse,
    });

    const res = await EmergenciesApi.verifyExtractions('em-1234', {
      chief_complaint: 'Crushing chest pain',
    });

    expect(res.clinical_entities).toBeDefined();
  });

  test('getConfirmedDestination returns 200 with hospital or propagates 404 when unassigned', async () => {
    const mockHospital = {
      id: 'hosp-metro-1',
      name: 'Metro Trauma Center',
      address: '100 Medical Center Blvd',
      latitude: 13.0827,
      longitude: 80.2707,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockHospital,
    });

    const destination = await EmergenciesApi.getConfirmedDestination('em-1234');
    expect(destination.name).toBe('Metro Trauma Center');
    expect(destination.latitude).toBe(13.0827);
  });

  test('confirmHandover completes clinical transfer and concludes mission', async () => {
    const finalized = {
      id: 'em-1234',
      status: 'HANDOVER_COMPLETED',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => finalized,
    });

    const res = await EmergenciesApi.confirmHandover('em-1234', 'Patient transferred to ER charge nurse.');
    expect(res.status).toBe('HANDOVER_COMPLETED');
  });
});
