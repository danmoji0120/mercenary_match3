import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileContent, ContentCompilationError } from './content-compiler.mjs';

const fixture = path.resolve('apps/server/tests/fixtures/content/characters/custom_test_character');
const temporary = [];
afterEach(() => { for (const value of temporary.splice(0)) rmSync(value, { recursive: true, force: true }) });

function setup() {
  const base = mkdtempSync(path.join(tmpdir(), 'mercenary-content-')); temporary.push(base);
  const root = path.join(base, 'characters'), packageDir = path.join(root, 'custom_test_character'); cpSync(fixture, packageDir, { recursive: true });
  return { base, root, packageDir };
}
function json(file) { return JSON.parse(readFileSync(file, 'utf8')) }
function save(file, value) { writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8') }
function expectCode(code, mutate) {
  const values = setup(); mutate(values);
  try { compileContent({ root: values.root, generatedDir: path.join(values.base, 'generated'), write: false }); throw new Error('Expected compilation failure') }
  catch (error) { expect(error).toBeInstanceOf(ContentCompilationError); expect(error.issues.map((item) => item.code)).toContain(code) }
}

describe('character package compiler', () => {
  it('generates deterministic normalized content and static trusted imports', () => {
    const { base, root } = setup(), first = path.join(base, 'first'), second = path.join(base, 'second');
    const a = compileContent({ root, generatedDir: first }), b = compileContent({ root, generatedDir: second });
    expect(a.normalized).toEqual(b.normalized);
    for (const file of ['character-registry.generated.ts', 'custom-handler-registry.generated.ts', 'normalized-content.generated.json', 'content-report.generated.json']) expect(readFileSync(path.join(first, file), 'utf8')).toBe(readFileSync(path.join(second, file), 'utf8'));
    expect(readFileSync(path.join(first, 'custom-handler-registry.generated.ts'), 'utf8')).toContain("import { characterServerModule as module0 }");
  });

  it('rejects manifest and declared path failures', () => {
    expectCode('CONTENT_MANIFEST_MISSING', ({ packageDir }) => unlinkSync(path.join(packageDir, 'manifest.json')));
    expectCode('CONTENT_FOLDER_ID_MISMATCH', ({ packageDir }) => { const file = path.join(packageDir, 'manifest.json'), value = json(file); value.id = 'wrong_folder'; save(file, value) });
    expectCode('CONTENT_SCHEMA_VERSION', ({ packageDir }) => { const file = path.join(packageDir, 'manifest.json'), value = json(file); value.schemaVersion = 99; save(file, value) });
    expectCode('CONTENT_ENGINE_API_VERSION', ({ packageDir }) => { const file = path.join(packageDir, 'manifest.json'), value = json(file); value.engineApiVersion = 99; save(file, value) });
    expectCode('CONTENT_PATH_ESCAPE', ({ packageDir }) => { const file = path.join(packageDir, 'manifest.json'), value = json(file); value.activeFile = '../active.json'; save(file, value) });
    expectCode('CONTENT_FILE_MISSING', ({ packageDir }) => { const file = path.join(packageDir, 'manifest.json'), value = json(file); value.activeFile = './missing.json'; save(file, value) });
  });

  it('rejects invalid character identity, stats, roles, and references', () => {
    expectCode('CONTENT_RARITY', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.rarity = 'UR'; save(file, value) });
    expectCode('CONTENT_ROLE', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.role = 'WIZARD'; save(file, value) });
    expectCode('CONTENT_MAX_HP', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.stats.maxHp = -1; save(file, value) });
    expectCode('CONTENT_STAT_PERCENT', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.stats.swordEffectPct = -1; save(file, value) });
    expectCode('CONTENT_ACTIVE_REFERENCE', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.activeAbilityId = 'missing'; save(file, value) });
    expectCode('CONTENT_SUPPORT_REFERENCE', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.supportAbilityId = 'missing'; save(file, value) });
    expectCode('CONTENT_DUPLICATE_CHARACTER_ID', ({ root, packageDir }) => { const second = path.join(root, 'second_character'); cpSync(packageDir, second, { recursive: true }); const manifestFile = path.join(second, 'manifest.json'), manifest = json(manifestFile); manifest.id = 'second_character'; save(manifestFile, manifest) });
    expectCode('CONTENT_DUPLICATE_ABILITY_ID', ({ root, packageDir }) => { const second = path.join(root, 'second_character'); cpSync(packageDir, second, { recursive: true }); const manifestFile = path.join(second, 'manifest.json'), manifest = json(manifestFile); manifest.id = 'second_character'; save(manifestFile, manifest); const characterFile = path.join(second, 'character.json'), character = json(characterFile); character.id = 'second_character'; save(characterFile, character) });
  });

  it('rejects invalid ability, trigger, effect, target, and limits', () => {
    expectCode('CONTENT_ABILITY_KIND', ({ packageDir }) => { const file = path.join(packageDir, 'active.json'), value = json(file); value.kind = 'SUPPORT'; save(file, value) });
    expectCode('CONTENT_COOLDOWN', ({ packageDir }) => { const file = path.join(packageDir, 'support.json'), value = json(file); value.cooldownMs = -1; save(file, value) });
    expectCode('CONTENT_CHAIN_LIMIT', ({ packageDir }) => { const file = path.join(packageDir, 'support.json'), value = json(file); value.chainLimit = { maxTriggers: 0 }; save(file, value) });
    expectCode('CONTENT_TRIGGER_EVENT', ({ packageDir }) => { const file = path.join(packageDir, 'support.json'), value = json(file); value.trigger.event = 'UNKNOWN'; save(file, value) });
    expectCode('CONTENT_EFFECT_TYPE', ({ packageDir }) => { const file = path.join(packageDir, 'active.json'), value = json(file); value.effects[0].type = 'UNKNOWN'; save(file, value) });
    expectCode('CONTENT_EFFECT_TARGET', ({ packageDir }) => { const file = path.join(packageDir, 'support.json'), value = json(file); value.effects[0].target = 'EVERYONE'; save(file, value) });
    expectCode('CONTENT_COMPARE_OPERATOR', ({ packageDir }) => { const file = path.join(packageDir, 'support.json'), value = json(file); value.trigger.filter = { type: 'COMPARE', left: { type: 'CONSTANT', value: 1 }, operator: 'ABOUT', right: { type: 'CONSTANT', value: 1 } }; save(file, value) });
  });

  it('rejects unsafe expressions and missing custom handlers', () => {
    expectCode('CONTENT_RESULT_REFERENCE_ORDER', ({ packageDir }) => { const file = path.join(packageDir, 'active.json'), value = json(file); value.effects[0] = { type: 'ADD_SHIELD', target: 'SELF', amount: { type: 'RESULT_VALUE', resultKey: 'later', path: 'finalAmount' } }; save(file, value) });
    expectCode('CONTENT_DIVIDE_BY_ZERO', ({ packageDir }) => { const file = path.join(packageDir, 'active.json'), value = json(file); value.effects[0] = { type: 'ADD_SHIELD', target: 'SELF', amount: { type: 'DIVIDE', values: [{ type: 'CONSTANT', value: 1 }, { type: 'CONSTANT', value: 0 }] } }; save(file, value) });
    expectCode('CONTENT_EVENT_PATH', ({ packageDir }) => { const file = path.join(packageDir, 'active.json'), value = json(file); value.effects[0] = { type: 'ADD_SHIELD', target: 'SELF', amount: { type: 'EVENT_VALUE', path: 'unknown.path' } }; save(file, value) });
    expectCode('CONTENT_CUSTOM_HANDLER_MISSING', ({ packageDir }) => { const file = path.join(packageDir, 'active.json'), value = json(file); value.effects[0].handlerId = 'custom_test_character.missing'; save(file, value) });
    expectCode('CONTENT_PRESENTATION_COMBAT_FIELD', ({ packageDir }) => { const manifestFile = path.join(packageDir, 'manifest.json'), manifest = json(manifestFile); manifest.presentationFile = './presentation.json'; save(manifestFile, manifest); save(path.join(packageDir, 'presentation.json'), { animationKey: 'safe', damage: 999 }) });
  });

  it('copies package-local raster portraits to deterministic hashed URLs', () => {
    const { base, root, packageDir } = setup(), assetDir = path.join(packageDir, 'assets'); mkdirSync(assetDir);
    const portrait = path.join(assetDir, 'portrait.png'); writeFileSync(portrait, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]));
    const characterFile = path.join(packageDir, 'character.json'), character = json(characterFile); character.assets = { portrait: './assets/portrait.png' }; save(characterFile, character);
    const generatedDir = path.join(base, 'generated'), assetOutputDir = path.join(base, 'assets-out');
    const first = compileContent({ root, generatedDir, assetOutputDir }), definition = first.normalized.packages[0].character;
    expect(definition.portraitAsset).toMatch(/^\/generated\/characters\/custom_test_character\/portrait\.[a-f0-9]{12}\.png$/);
    expect(readFileSync(path.join(assetOutputDir, definition.portraitAsset.split('/').slice(3).join('/')))).toEqual(readFileSync(portrait));
    const previous = definition.portraitAsset; expect(compileContent({ root, generatedDir, assetOutputDir }).normalized.packages[0].character.portraitAsset).toBe(previous);
    writeFileSync(portrait, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 2]));
    const changed = compileContent({ root, generatedDir, assetOutputDir }).normalized.packages[0].character.portraitAsset; expect(changed).not.toBe(previous);
    expect(existsSync(path.join(assetOutputDir, previous.split('/').slice(3).join('/')))).toBe(false);
    const jpeg = path.join(assetDir, 'portrait.jpg'); writeFileSync(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0])); character.assets.portrait = './assets/portrait.jpg'; save(characterFile, character);
    expect(compileContent({ root, generatedDir, assetOutputDir }).normalized.packages[0].character.portraitAsset).toMatch(/\.jpg$/);
    const webp = path.join(assetDir, 'portrait.webp'); writeFileSync(webp, Buffer.from('RIFF0000WEBP', 'ascii')); character.assets.portrait = './assets/portrait.webp'; save(characterFile, character);
    expect(compileContent({ root, generatedDir, assetOutputDir }).normalized.packages[0].character.portraitAsset).toMatch(/\.webp$/);
  });

  it('rejects unsafe, unsupported, oversized, and signature-mismatched portraits', () => {
    expectCode('CONTENT_PORTRAIT_PATH', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.assets = { portrait: '../portrait.png' }; save(file, value) });
    expectCode('CONTENT_PORTRAIT_PATH', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.assets = { portrait: 'https://example.invalid/portrait.png' }; save(file, value) });
    expectCode('CONTENT_PORTRAIT_PATH', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.assets = { portrait: 'data:image/png;base64,AA==' }; save(file, value) });
    expectCode('CONTENT_PORTRAIT_EXTENSION', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.assets = { portrait: './portrait.svg' }; save(file, value); writeFileSync(path.join(packageDir, 'portrait.svg'), Buffer.from('<svg/>')) });
    expectCode('CONTENT_PORTRAIT_SIGNATURE', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.assets = { portrait: './portrait.png' }; save(file, value); writeFileSync(path.join(packageDir, 'portrait.png'), Buffer.from('not-png')) });
    expectCode('CONTENT_PORTRAIT_SIZE', ({ packageDir }) => { const file = path.join(packageDir, 'character.json'), value = json(file); value.assets = { portrait: './portrait.png' }; save(file, value); const data = Buffer.alloc(8 * 1024 * 1024 + 1); data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); writeFileSync(path.join(packageDir, 'portrait.png'), data) });
    expectCode('CONTENT_PORTRAIT_SYMLINK_ESCAPE', ({ base, packageDir }) => { const outside = path.join(base, 'outside'); mkdirSync(outside); writeFileSync(path.join(outside, 'portrait.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); symlinkSync(outside, path.join(packageDir, 'linked'), 'junction'); const file = path.join(packageDir, 'character.json'), value = json(file); value.assets = { portrait: './linked/portrait.png' }; save(file, value) });
  });
});
