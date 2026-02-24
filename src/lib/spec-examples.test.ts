import { describe, it, expect } from 'vitest';
import { generateSpec, generateFilename } from './generator';

describe('Spec Examples for Documentation', () => {
  it('generates and saves minimal and detailed specs', () => {
    const minimalAnswers = {
      persona: 'developer' as const,
      title: 'Daily Task Counter',
      description:
        'Simple counter to track tasks completed each day. No persistence—just a daily tally.',
      headlineValue: 'Count your wins',
      audience: 'Personal use',
      usageFrequency: 'daily' as const,
      deviceTarget: 'both' as const,
      dataSource: 'no-external' as const,
      scale: 'personal' as const,
      pageCount: 'single' as const,
      hosting: 'cloudflare-pages' as const,
      stackConfirmed: true,
    };

    const detailedAnswers = {
      persona: 'developer' as const,
      title: 'Weather Dashboard',
      description:
        'Real-time weather app showing current conditions and 7-day forecast. Public app for commuters.',
      headlineValue: 'See weather anywhere',
      audience: 'Commuters',
      usageFrequency: 'daily' as const,
      deviceTarget: 'both' as const,
      dataSource: 'public-api' as const,
      scale: 'public' as const,
      dataFreshness: 'hourly' as const,
      apiDescription:
        'Current weather and 7-day forecast by location (temperature, conditions, UV index)',
      apiKnownName: 'Open-Meteo',
      pageCount: 'many' as const,
      hosting: 'cloudflare-pages' as const,
      stackConfirmed: true,
    };

    const minimalSpec = generateSpec(minimalAnswers);
    const minimalFilename = generateFilename(minimalAnswers);

    const detailedSpec = generateSpec(detailedAnswers);
    const detailedFilename = generateFilename(detailedAnswers);

    // Verify specs generate correctly
    expect(minimalSpec.length).toBeGreaterThan(0);
    expect(detailedSpec.length).toBeGreaterThan(0);
    expect(minimalSpec).toContain('Development Stages');
    expect(detailedSpec).toContain('Development Stages');

    console.log('\n✓ Specs generated and validated:');
    console.log(`  - ${minimalFilename} (${minimalSpec.split('\n').length} lines)`);
    console.log(`  - ${detailedFilename} (${detailedSpec.split('\n').length} lines)`);
  });
});
