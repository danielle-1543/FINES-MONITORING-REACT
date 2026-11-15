import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
const context = vm.createContext({ TextEncoder })
const module = new vm.SourceTextModule(await readFile(new URL('../src/utils/emailOtp.js', import.meta.url), 'utf8'), { context })
await module.link(() => new vm.SyntheticModule(['apiFetch'], function () { this.setExport('apiFetch', () => { throw new Error('Unexpected network request') }) }, { context }))
await module.evaluate()
const { passwordError, PASSWORD_REQUIREMENTS } = module.namespace

test('registration and reset passwords require length and every character category', () => {
    for (const password of [null, '', 'Short1!', 'strongpass1!', 'STRONGPASS1!', 'StrongPass!!', 'StrongPass12', 'StrongPass1 ', 'StrongPass1é', 'StrongPass1!\0']) {
        assert.equal(passwordError(password), PASSWORD_REQUIREMENTS)
    }
    assert.equal(passwordError('StrongPass1!'), '')
    assert.equal(passwordError('Long passphrase 1!'), '')
})

test('UTF-8 byte limit prevents bcrypt truncation without trimming passwords', () => {
    assert.equal(passwordError('Aa1!' + 'a'.repeat(68)), '')
    assert.equal(passwordError('Aa1!' + 'a'.repeat(69)), PASSWORD_REQUIREMENTS)
    assert.equal(passwordError('Aa1!' + 'é'.repeat(34)), '')
    assert.equal(passwordError('Aa1!' + 'é'.repeat(35)), PASSWORD_REQUIREMENTS)
    assert.equal(passwordError('Aa1!' + '😀'.repeat(8)), '')
    assert.equal(passwordError('Aa1!' + '😀'.repeat(7)), PASSWORD_REQUIREMENTS)
    assert.equal(passwordError(' StrongPass1! '), '')
})
