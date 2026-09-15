import { describe, expect, it } from 'vitest'
import { normalizeVi } from '../src/utils/normalize'
describe('Vietnamese search',()=>{it('ignores diacritics',()=>expect(normalizeVi('Minh Thư')).toBe('minh thu'));it('handles đ',()=>expect(normalizeVi('Đức')).toBe('duc'))})
