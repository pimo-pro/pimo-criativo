import { describe, expect, it } from 'vitest';

import { regenerateAllStaleWorkOrderNqrMetadata } from '@/industrial/api/workOrderActions';

const shouldRun = process.env.REGEN_NQR === '1';

describe.runIf(shouldRun)('regenerateWorkOrderNqrMetadata (runtime)', () => {
  it(
    'regenera metadata N-QR v5 das WOs antigas',
    async () => {
      const report = await regenerateAllStaleWorkOrderNqrMetadata();
      console.log(JSON.stringify(report, null, 2));
      expect(report).toBeDefined();
    },
    600_000,
  );
});
