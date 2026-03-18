import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '.next/',
        'dist/',
        // 빌드 설정 파일
        'next.config.mjs',
        'postcss.config.js',
        'tailwind.config.ts',
        // 서버 엔트리 포인트 (Next.js + Express 부트스트랩)
        'server/index.ts',
        // Next.js 페이지/컴포넌트 (UI 테스트 별도)
        'src/app/**',
        'src/components/**',
        'src/hooks/**',
        'src/store/**',
        // 상수/템플릿 (로직 없음)
        'src/constants/categories.ts',
        'src/lib/socket/events.ts',
        'src/lib/ai/prompts.ts',
        // 외부 API 래퍼 (AI 모킹으로 간접 테스트)
        'src/lib/ai/claude-ai.ts',
        // 브라우저 싱글톤
        'src/lib/socket/client.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
