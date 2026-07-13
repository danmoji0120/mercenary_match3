import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContent } from './content-compiler.mjs';
import { checkContentDocs, generateContentDocs } from './generate-content-docs.mjs';
import * as schema from './content-schema-metadata.mjs';

const jsonFile = path.resolve('apps/server/src/generated/content-capabilities.generated.json');

describe('generated skill framework capability reference', () => {
  it('generates deterministic JSON and Markdown without machine-specific values', () => {
    const first = generateContentDocs({ write: false }), second = generateContentDocs({ write: false });
    expect(first.jsonText).toBe(second.jsonText); expect(first.markdownText).toBe(second.markdownText);
    expect(first.jsonText).not.toContain(path.resolve('.')); expect(first.markdownText).not.toContain(path.resolve('.'));
    expect(first.jsonText).not.toMatch(/20\d\d-\d\d-\d\dT\d\d:/);
    expect(first.markdownText).toContain('AUTO-GENERATED FILE. DO NOT EDIT.');
  });

  it('matches compiler canonical values and runtime executor evidence structurally', () => {
    const { manifest } = generateContentDocs({ write: false });
    expect(Object.keys(manifest.effects)).toEqual(schema.EFFECT_TYPES);
    expect(Object.keys(manifest.valueExpressions)).toEqual(schema.VALUE_TYPES);
    expect(Object.keys(manifest.conditions)).toEqual(schema.CONDITION_TYPES);
    expect(Object.keys(manifest.triggers)).toEqual(Object.keys(schema.TRIGGER_MAP).sort());
    expect(manifest.targets).toEqual(schema.TARGETS); expect(Object.keys(manifest.resources)).toEqual(schema.RESOURCES); expect(manifest.stats).toEqual(schema.STATS);
    for (const [type, detail] of Object.entries(manifest.effects)) {
      expect(detail.runtimeType).toBe(schema.EFFECT_RUNTIME_MAP[type]);
      expect(detail.exampleValidatorStatus).toBe('PASSED');
      expect(detail.example).toBeTruthy();
      if (detail.supportStatus === 'SUPPORTED') { expect(manifest.evidence.runtimeAllowedEffects).toContain(detail.runtimeType); expect(manifest.evidence.runtimeExecutorEffects).toContain(detail.runtimeType); expect(manifest.evidence.runtimeVerifiedEffects).toContain(detail.runtimeType) }
    }
  });

  it('does not mark trigger types as emitted without a real dispatch call', () => {
    const { manifest } = generateContentDocs({ write: false });
    for (const detail of Object.values(manifest.triggers)) {
      expect(detail.supportStatus === 'EMITTED_AND_SUPPORTED').toBe(manifest.evidence.emittedRuntimeTriggers.includes(detail.runtimeType));
      expect(detail.exampleValidatorStatus).toBe('PASSED');
      expect(detail.example).toBeTruthy();
    }
    expect(manifest.triggers.BEFORE_DAMAGE.supportStatus).toBe('TYPE_DEFINED_NOT_EMITTED');
    expect(manifest.triggers.BEFORE_ATTACK_IMPACT.supportStatus).toBe('EMITTED_AND_SUPPORTED');
  });

  it('keeps event/result paths and custom commands tied to canonical evidence', () => {
    const { manifest } = generateContentDocs({ write: false });
    expect(Object.keys(manifest.eventPaths)).toEqual(schema.EVENT_PATHS);
    expect(manifest.resultPathAllowlist).toEqual(schema.RESULT_PATHS);
    expect(Object.keys(manifest.customHandlers.commands)).toEqual(manifest.customHandlers.detectedBuilderCommands);
    expect(Object.values(manifest.examples).every((example) => example.validatorStatus === 'PASSED')).toBe(true);
  });

  it('rejects an invalid documented-style package example', () => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'bad-capability-example-'));
    try {
      const source = path.resolve('apps/server/tests/fixtures/content/characters/custom_test_character'), destination = path.join(temporary, 'custom_test_character'); cpSync(source, destination, { recursive: true });
      const activeFile = path.join(destination, 'active.json'), active = JSON.parse(readFileSync(activeFile, 'utf8')); active.effects[0].type = 'NOT_A_REAL_EFFECT'; writeFileSync(activeFile, JSON.stringify(active), 'utf8');
      expect(() => compileContent({ root: temporary, write: false })).toThrow('CONTENT_EFFECT_TYPE');
    } finally { rmSync(temporary, { recursive: true, force: true }) }
  });

  it('detects manual generated-file edits and recovers after restoration', () => {
    const original = readFileSync(jsonFile, 'utf8');
    try { writeFileSync(jsonFile, `${original} `, 'utf8'); expect(() => checkContentDocs()).toThrow('CONTENT_DOCS_STALE') }
    finally { writeFileSync(jsonFile, original, 'utf8') }
    expect(() => checkContentDocs()).not.toThrow();
  });
});
