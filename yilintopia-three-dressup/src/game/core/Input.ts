export class Input {
  private keys = new Set<string>();
  consumeInteract = false;

  start() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  stop() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  get axis() {
    const forward = Number(this.keys.has('w') || this.keys.has('arrowup')) - Number(this.keys.has('s') || this.keys.has('arrowdown'));
    const right = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    return { forward, right };
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keys.add(key);
    if (key === 'e') this.consumeInteract = true;
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };
}
