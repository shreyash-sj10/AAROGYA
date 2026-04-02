const assert = require('assert');

async function run() {
  const originalFetch = global.fetch;

  // 1) Python running -> AI used
  global.fetch = async (url) => {
    if (String(url).includes('/health')) {
      return { ok: true, async json(){ return { status: 'ok' }; } };
    }
    if (String(url).includes('/ai/profile')) {
      return { ok: true, async json(){ return { success: true, data: { risk_flags:['high_pitta'], dosha_estimate:{vata:0.2,pitta:0.5,kapha:0.3}, confidence:0.8 }, error: null }; } };
    }
    if (String(url).includes('/ai/explain')) {
      return { ok: true, async json(){ return { success: true, data: { explanation: 'grounded', citations: [] }, error: null }; } };
    }
    return { ok: true, async json(){ return { success: true, data: { feedback_type:'LIKE', target:'poha' }, error: null }; } };
  };

  delete require.cache[require.resolve('../src/services/ml/mlClient')];
  const ml1 = require('../src/services/ml/mlClient');
  await ml1.checkAIHealth();

  const p1 = await ml1.getAIProfile('acidity');
  const e1 = await ml1.getExplanation({ context:{a:1}, reasoning:{b:2} });
  const f1 = await ml1.parseFeedback('replace poha');
  assert.strictEqual(p1.confidence, 0.8);
  assert.strictEqual(e1.explanation, 'grounded');
  assert.strictEqual(f1.feedback_type, 'LIKE');

  // 2) Python stopped -> fallback works
  global.fetch = async (url) => {
    if (String(url).includes('/health')) {
      throw new Error('down');
    }
    throw new Error('down');
  };
  delete require.cache[require.resolve('../src/services/ml/mlClient')];
  const ml2 = require('../src/services/ml/mlClient');
  await ml2.checkAIHealth();
  const p2 = await ml2.getAIProfile('acidity');
  assert.strictEqual(p2.confidence, 0.3);

  // 3) Invalid JSON envelope -> fallback
  global.fetch = async (url) => {
    if (String(url).includes('/health')) {
      return { ok: true, async json(){ return { status: 'ok' }; } };
    }
    return { ok: true, async json(){ return { nope: true }; } };
  };
  delete require.cache[require.resolve('../src/services/ml/mlClient')];
  const ml3 = require('../src/services/ml/mlClient');
  await ml3.checkAIHealth();
  const f3 = await ml3.parseFeedback('like');
  assert.strictEqual(f3.feedback_type, 'DISLIKE');

  // 4) Slow AI/timeout path -> fallback
  global.fetch = async (url) => {
    if (String(url).includes('/health')) {
      return { ok: true, async json(){ return { status: 'ok' }; } };
    }
    throw new Error('The operation was aborted');
  };
  delete require.cache[require.resolve('../src/services/ml/mlClient')];
  const ml4 = require('../src/services/ml/mlClient');
  await ml4.checkAIHealth();
  const f4 = await ml4.parseFeedback('like');
  assert.strictEqual(f4.feedback_type, 'DISLIKE');

  global.fetch = originalFetch;
  console.log('testLLMIntegration passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

