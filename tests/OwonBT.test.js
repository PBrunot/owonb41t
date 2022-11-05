const OwonBT = require('../owon');

describe('Basic API tests, without simulation', () => {
    test('API functions exists', () => {
        expect(OwonBT.Start).not.toBeNull();
        expect(OwonBT.Stop).not.toBeNull();
        expect(OwonBT.btState).not.toBeNull();
        expect(OwonBT.State).not.toBeNull();
        expect(OwonBT.SetLogLevel).not.toBeNull();
    })
    test('btState has the right properties', async () => {
        let data = OwonBT.btState;
        expect(data).not.toBeNull();
        expect(data).toHaveProperty('state');
        expect(data).toHaveProperty('prev_state');
        expect(data).toHaveProperty('started');
        expect(data).toHaveProperty('stopRequest');
        expect(data).toHaveProperty('response');
        expect(data).toHaveProperty('responseTimeStamp');
        expect(data).toHaveProperty('parsedResponse');
        expect(data).toHaveProperty('formattedResponse');
        expect(data).toHaveProperty('charRead');
        expect(data).toHaveProperty('btService');
        expect(data).toHaveProperty('btDevice');
        expect(data).toHaveProperty('stats');
    })
})

