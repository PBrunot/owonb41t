const OwonBT = require('../owon');

describe('Basic API tests, without simulation', () => {
    test('API functions exists', () => {
        expect(OwonBT.Start).not.toBeNull();
        expect(OwonBT.Stop).not.toBeNull();
        expect(OwonBT.btState).not.toBeNull();
        expect(OwonBT.State).not.toBeNull();
        expect(OwonBT.SetLogLevel).not.toBeNull();
    })
})

