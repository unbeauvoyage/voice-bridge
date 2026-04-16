/**
 * Compile-time path and port constants for the main process.
 *
 * __dirname in the compiled out/main/index.js is <project>/out/main —
 * going up twice reaches the project root.
 */

import { join } from 'path'
import { spawnSync } from 'node:child_process'
import { discoverPythonApp } from './pythonApp'

export const OVERLAY_PORT = 47890

export const PROJECT_ROOT = join(__dirname, '..', '..')
export const LAST_TARGET_FILE = join(PROJECT_ROOT, 'tmp', 'last-target.txt')
export const DAEMON_DIR = join(PROJECT_ROOT, 'daemon')
export const WAKE_WORD_SCRIPT = join(DAEMON_DIR, 'wake_word.py')
export const VENV_PACKAGES = join(DAEMON_DIR, '.venv/lib/python3.14/site-packages')
export const PYTHON_APP = discoverPythonApp({ spawnSync, env: process.env })
