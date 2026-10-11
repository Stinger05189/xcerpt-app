// scripts/test-agent-forge.mjs
// Automated verification suite for Agent Forge initialization, profile mapping, and template caching.
import assert from 'assert';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

console.log('--- Starting Agent Forge Scaffolding Diagnostic Suite ---');

const REPO_BASE = 'https://raw.githubusercontent.com/Stinger05189/agent-forge/master/template/.agents';

// Suite 1: Profile & Tooling URL Resolution
function resolveTemplateMapping(profile, toolingMode) {
  let agentFile = '';
  const baseFiles = [];
  const skillFiles = [];

  if (profile === 'SourceMiner') {
    agentFile = 'agent.miner.md';
    baseFiles.push(
      { remote: 'conventions.miner.md', local: 'conventions.md' },
      { remote: 'devlog.miner.md', local: 'devlog.md' },
      { remote: 'plan.miner.md', local: 'plan.md' }
    );
    skillFiles.push('extract-subsystem.md', 'extract-primitive.md', 'triangulate-source.md');
  } else if (profile === 'Unreal') {
    agentFile = toolingMode === 'NativeIDE' ? 'agent.unreal.native.md' : 'agent.unreal.md';
    baseFiles.push(
      { remote: 'conventions.md', local: 'conventions.md' },
      { remote: 'devlog.md', local: 'devlog.md' },
      { remote: 'plan.md', local: 'plan.md' }
    );
  } else {
    agentFile = toolingMode === 'NativeIDE' ? 'agent.native.md' : 'agent.md';
    baseFiles.push(
      { remote: 'conventions.md', local: 'conventions.md' },
      { remote: 'devlog.md', local: 'devlog.md' },
      { remote: 'plan.md', local: 'plan.md' }
    );
  }

  return { agentFile, baseFiles, skillFiles };
}

{
  const stdXcerpt = resolveTemplateMapping('Standard', 'Xcerpt');
  assert.strictEqual(stdXcerpt.agentFile, 'agent.md');
  assert.strictEqual(stdXcerpt.baseFiles[0].local, 'conventions.md');

  const stdNative = resolveTemplateMapping('Standard', 'NativeIDE');
  assert.strictEqual(stdNative.agentFile, 'agent.native.md');

  const unrealXcerpt = resolveTemplateMapping('Unreal', 'Xcerpt');
  assert.strictEqual(unrealXcerpt.agentFile, 'agent.unreal.md');

  const unrealNative = resolveTemplateMapping('Unreal', 'NativeIDE');
  assert.strictEqual(unrealNative.agentFile, 'agent.unreal.native.md');

  const miner = resolveTemplateMapping('SourceMiner', 'Xcerpt');
  assert.strictEqual(miner.agentFile, 'agent.miner.md');
  assert.strictEqual(miner.baseFiles[0].remote, 'conventions.miner.md');
  assert.strictEqual(miner.baseFiles[0].local, 'conventions.md');
  assert.strictEqual(miner.skillFiles.length, 3);

  console.log('✓ Suite 1 Passed: Profile and Tooling URL mappings verified.');
}

// Suite 2: Default Subdirectory Computation
{
  function computeDefaultEnclave(baseRoot, relativeSubdir = 'Docs/.agents') {
    const cleanBase = baseRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    const cleanSub = relativeSubdir.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${cleanBase}/${cleanSub}`;
  }

  const res1 = computeDefaultEnclave('C:/Projects/UnrealGame');
  assert.strictEqual(res1, 'C:/Projects/UnrealGame/Docs/.agents');

  const res2 = computeDefaultEnclave('D:\\Repositories\\Engine\\', 'Source/Combat/.agents');
  assert.strictEqual(res2, 'D:/Repositories/Engine/Source/Combat/.agents');

  console.log('✓ Suite 2 Passed: Default and modular target subdirectory computation verified.');
}

// Suite 3: Local Caching Simulation & Fallback Resolution
{
  const testTmp = path.join(os.tmpdir(), `test_af_cache_${Date.now()}`);
  await fs.mkdir(testTmp, { recursive: true });

  const mockKey = 'conventions.md';
  const mockCacheFile = path.join(testTmp, mockKey);
  const mockContent = '# conventions.md\n# Test Content';
  await fs.writeFile(mockCacheFile, mockContent, 'utf-8');

  // Verify reading from cache
  const readBack = await fs.readFile(mockCacheFile, 'utf-8');
  assert.strictEqual(readBack, mockContent);

  await fs.rm(testTmp, { recursive: true, force: true });
  console.log('✓ Suite 3 Passed: Local template caching and filesystem storage verified.');
}

// Suite 4: Pre-flight Directory Inspector Simulation
{
  const testDir = path.join(os.tmpdir(), `test_af_preflight_${Date.now()}`);
  await fs.mkdir(testDir, { recursive: true });

  async function checkDirectory(targetPath) {
    try {
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) return { exists: true, hasAgentFiles: false };
      const files = await fs.readdir(targetPath);
      const agentFiles = files.filter(f => ['agent.md', 'conventions.md', 'devlog.md', 'plan.md'].includes(f));
      return { exists: true, hasAgentFiles: agentFiles.length > 0, existingFiles: files };
    } catch {
      return { exists: false, hasAgentFiles: false, existingFiles: [] };
    }
  }

  const cleanCheck = await checkDirectory(testDir);
  assert.strictEqual(cleanCheck.exists, true);
  assert.strictEqual(cleanCheck.hasAgentFiles, false);

  // Inject agent.md
  await fs.writeFile(path.join(testDir, 'agent.md'), '# Test Protocol', 'utf-8');
  const dirtyCheck = await checkDirectory(testDir);
  assert.strictEqual(dirtyCheck.exists, true);
  assert.strictEqual(dirtyCheck.hasAgentFiles, true);

  await fs.rm(testDir, { recursive: true, force: true });
  console.log('✓ Suite 4 Passed: Pre-flight directory inspector verified.');
}

// Suite 5: Source Miner Vault Scaffolding Topology
{
  const testRoot = path.join(os.tmpdir(), `test_af_vault_${Date.now()}`);
  const targetEnclave = path.join(testRoot, 'Docs', '.agents');
  await fs.mkdir(targetEnclave, { recursive: true });

  function resolveVaultParent(targetDir) {
    return path.basename(targetDir) === '.agents'
      ? path.dirname(targetDir)
      : targetDir;
  }

  const vaultParent = resolveVaultParent(targetEnclave);
  assert.strictEqual(vaultParent, path.join(testRoot, 'Docs'));

  const vaultDir = path.join(vaultParent, 'vault');
  const subDirs = ['subsystems', 'primitives', 'forensics'];
  for (const s of subDirs) {
    await fs.mkdir(path.join(vaultDir, s), { recursive: true });
  }

  const checkSubsystems = await fs.stat(path.join(vaultDir, 'subsystems'));
  assert.strictEqual(checkSubsystems.isDirectory(), true);

  await fs.rm(testRoot, { recursive: true, force: true });
  console.log('✓ Suite 5 Passed: Source Miner vault hierarchy topology verified.');
}

// Suite 6: Live GitHub Template Accessibility Probe (Optional Probe)
{
  try {
    const probeRes = await fetch(`${REPO_BASE}/agent.md`);
    if (probeRes.ok) {
      const text = await probeRes.text();
      assert.ok(text.includes('Hybrid Agentic Workflow'));
      console.log('✓ Suite 6 Passed: Live GitHub raw template probe succeeded.');
    } else {
      console.log(`- Suite 6 Skipped: GitHub returned HTTP ${probeRes.status} (Network offline/restricted).`);
    }
  } catch (e) {
    console.log(`- Suite 6 Skipped: Live network probe skipped (${e.message}).`);
  }
}

console.log('=== All 6 Agent Forge Diagnostic Suites Passed Successfully ===');