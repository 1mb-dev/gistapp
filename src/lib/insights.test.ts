import { describe, expect, it, vi } from 'vitest';
import { fireQuestionAbandoned } from './insights';

describe('fireQuestionAbandoned', () => {
  it('sends a beacon with the expected payload when on a question', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const result = fireQuestionAbandoned(
      {
        currentQuestionId: 'audience',
        persona: 'developer',
        stepIndex: 1,
        userReachedSpec: false,
      },
      sendBeacon,
      'https://insights.test/api/event',
    );
    expect(result).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeacon.mock.calls[0];
    expect(url).toBe('https://insights.test/api/event');
    const text = body instanceof Blob ? '' : String(body);
    if (body instanceof Blob) {
      // jsdom Blob exposes text(); resolve synchronously via mock if needed
      return body.text().then((decoded: string) => {
        expect(JSON.parse(decoded)).toEqual({
          event: 'question_abandoned',
          questionId: 'audience',
          persona: 'developer',
          stepIndex: 1,
        });
      });
    }
    expect(JSON.parse(text)).toEqual({
      event: 'question_abandoned',
      questionId: 'audience',
      persona: 'developer',
      stepIndex: 1,
    });
  });

  it('does not send when currentQuestionId is null', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const result = fireQuestionAbandoned(
      { currentQuestionId: null, persona: 'developer', stepIndex: 0, userReachedSpec: false },
      sendBeacon,
    );
    expect(result).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('does not send when userReachedSpec is true', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const result = fireQuestionAbandoned(
      {
        currentQuestionId: 'audience',
        persona: 'developer',
        stepIndex: 1,
        userReachedSpec: true,
      },
      sendBeacon,
    );
    expect(result).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('returns false when sendBeacon rejects the queue', () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    const result = fireQuestionAbandoned(
      {
        currentQuestionId: 'audience',
        persona: 'developer',
        stepIndex: 1,
        userReachedSpec: false,
      },
      sendBeacon,
    );
    expect(result).toBe(false);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
