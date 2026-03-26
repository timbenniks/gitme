let _verbose = false;

export function setVerbose(value: boolean): void {
  _verbose = value;
}

export function isVerbose(): boolean {
  return _verbose;
}

export function debug(msg: string): void {
  if (_verbose) {
    console.error(`[debug] ${msg}`);
  }
}
