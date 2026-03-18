import { describe, it, expect } from 'vitest';
import { cn, generateRoomCode, generateId } from '@/lib/utils';

// ─── generateRoomCode ─────────────────────────────────────────────────────────

describe('generateRoomCode', () => {
  it('6자리 문자열을 반환한다', () => {
    expect(generateRoomCode()).toHaveLength(6);
  });

  it('허용된 문자만 포함한다 (I, O, 1, 0 제외한 대문자+숫자)', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('혼동하기 쉬운 문자(I, O, 1, 0)가 포함되지 않는다', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[IO10]/);
    }
  });

  it('여러 번 호출 시 다양한 코드가 생성된다 (랜덤성 검증)', () => {
    const codes = new Set(Array.from({ length: 50 }, generateRoomCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ─── generateId ───────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('UUID v4 형식 문자열을 반환한다', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('여러 번 호출 시 서로 다른 ID가 생성된다', () => {
    const ids = new Set(Array.from({ length: 20 }, generateId));
    expect(ids.size).toBe(20);
  });

  it('문자열을 반환한다', () => {
    expect(typeof generateId()).toBe('string');
  });
});

// ─── cn ───────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('단일 클래스를 그대로 반환한다', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('여러 클래스를 공백으로 병합한다', () => {
    const result = cn('text-red-500', 'bg-blue-100');
    expect(result).toContain('text-red-500');
    expect(result).toContain('bg-blue-100');
  });

  it('falsy 값을 무시한다 (false, undefined, null, 빈 문자열)', () => {
    expect(cn('text-red-500', false, undefined, null, '')).toBe('text-red-500');
  });

  it('Tailwind 충돌 클래스는 마지막 것이 우선 적용된다', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
    expect(result).not.toContain('text-red-500');
  });

  it('조건부 클래스를 처리한다', () => {
    const isActive = true;
    const result = cn('base-class', isActive && 'active-class');
    expect(result).toContain('base-class');
    expect(result).toContain('active-class');
  });

  it('조건이 false면 해당 클래스를 포함하지 않는다', () => {
    const isError = false;
    const result = cn('base-class', isError && 'error-class');
    expect(result).toBe('base-class');
    expect(result).not.toContain('error-class');
  });

  it('빈 호출 시 빈 문자열을 반환한다', () => {
    expect(cn()).toBe('');
  });
});
