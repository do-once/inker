import { createLibConfig } from '@inker/web-rig/library/vite.lib.config'
import pkg from './package.json'
export default createLibConfig(pkg.main, pkg.name)
