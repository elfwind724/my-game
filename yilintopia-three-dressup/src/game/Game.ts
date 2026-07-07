import * as THREE from 'three';
import { Input } from './core/Input';
import { loadState, resetState, saveState } from './core/SaveSystem';
import { accessories, achievements, collectibles, npcs, outfits, quests, type Accessory, type Collectible, type Npc, type Outfit } from './data/content';
import type { GameState } from './simulation/state';

type Interactable =
  | { type: 'npc'; id: string; distance: number }
  | { type: 'collectible'; id: string; distance: number };

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  private clock = new THREE.Clock();
  private input = new Input();
  private state: GameState = loadState();
  private player = new THREE.Group();
  private bodyMaterial = new THREE.MeshStandardMaterial();
  private skirtMaterial = new THREE.MeshStandardMaterial();
  private shoeMaterial = new THREE.MeshStandardMaterial();
  private hatGroup = new THREE.Group();
  private wingGroup = new THREE.Group();
  private collectibleMeshes = new Map<string, THREE.Group>();
  private uiDirty = true;
  private panel: 'none' | 'wardrobe' | 'quests' = 'none';
  private interactable: Interactable | null = null;
  private dialog: { name: string; text: string } | null = null;
  private toast = '';
  private toastUntil = 0;
  private raf = 0;

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLDivElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color('#ffe8f6');
    this.scene.fog = new THREE.Fog('#ffe8f6', 34, 80);
  }

  start() {
    this.setupLights();
    this.createWorld();
    this.createPlayer();
    this.applyWardrobe();
    this.input.start();
    window.addEventListener('resize', this.resize);
    this.resize();
    this.loop();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.stop();
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight('#ffffff', '#e6c9ff', 1.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff2d1', 2.5);
    sun.position.set(12, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
  }

  private createWorld() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(24, 96),
      new THREE.MeshStandardMaterial({ color: '#bff3cf', roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const pathMat = new THREE.MeshStandardMaterial({ color: '#ffe1a8', roughness: 0.85 });
    for (let i = 0; i < 16; i++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.2), pathMat);
      tile.position.set(Math.sin(i * 0.55) * 4.5, 0.03, i * 1.8 - 14);
      tile.rotation.y = Math.sin(i) * 0.4;
      tile.receiveShadow = true;
      this.scene.add(tile);
    }

    this.addDecorations();
    this.addNpcs();
    this.addCollectibles();
  }

  private addDecorations() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#9b6743' });
    const leafColors = ['#89df8d', '#ffb1d9', '#acd8ff', '#f9d86e'];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = 13 + (i % 5) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.5, 8), trunkMat);
      trunk.position.set(x, 0.75, z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), new THREE.MeshStandardMaterial({ color: leafColors[i % leafColors.length], roughness: 0.7 }));
      crown.position.set(x, 1.75, z);
      crown.castShadow = true;
      this.scene.add(crown);
    }

    for (let i = 0; i < 10; i++) {
      const mushroom = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.42, 10), new THREE.MeshStandardMaterial({ color: '#fff0db' }));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: i % 2 ? '#ff7fb6' : '#8ca8ff' }));
      cap.position.y = 0.25;
      mushroom.add(stem, cap);
      mushroom.position.set(Math.sin(i * 1.7) * 11, 0.22, Math.cos(i * 1.3) * 11);
      this.scene.add(mushroom);
    }
  }

  private addNpcs() {
    for (const npc of npcs) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.65, 8, 14), new THREE.MeshStandardMaterial({ color: '#fff7dc', roughness: 0.72 }));
      body.position.y = 0.78;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), new THREE.MeshStandardMaterial({ color: '#ffe6c9', roughness: 0.65 }));
      head.position.y = 1.42;
      const badge = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 24), new THREE.MeshStandardMaterial({ color: '#ff9bd6' }));
      badge.position.set(0, 1.02, 0.42);
      group.add(body, head, badge);
      group.position.set(npc.x, 0, npc.z);
      this.scene.add(group);
    }
  }

  private addCollectibles() {
    for (const item of collectibles) {
      if (this.state.collectedIds.includes(item.id)) continue;
      const group = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), new THREE.MeshStandardMaterial({ color: item.id.includes('heart') ? '#ff639c' : '#fff05a', emissive: '#442200', emissiveIntensity: 0.22, roughness: 0.4 }));
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 32), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.72 }));
      halo.rotation.x = Math.PI / 2;
      group.add(core, halo);
      group.position.set(item.x, 0.82, item.z);
      this.scene.add(group);
      this.collectibleMeshes.set(item.id, group);
    }
  }

  private createPlayer() {
    this.player.name = '冯以琳';
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), new THREE.MeshStandardMaterial({ color: '#ffe2c7', roughness: 0.65 }));
    head.position.y = 1.55;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: '#3b2432', roughness: 0.85 }));
    hair.position.y = 1.68;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.7, 8, 16), this.bodyMaterial);
    body.position.y = 0.95;
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.48, 24), this.skirtMaterial);
    skirt.position.y = 0.57;
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.42), this.shoeMaterial);
    leftShoe.position.set(-0.18, 0.08, 0.08);
    const rightShoe = leftShoe.clone();
    rightShoe.position.x = 0.18;
    this.hatGroup.position.y = 2.03;
    this.wingGroup.position.set(0, 1.08, -0.32);
    this.player.add(body, skirt, head, hair, leftShoe, rightShoe, this.hatGroup, this.wingGroup);
    this.player.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });
    this.scene.add(this.player);
  }

  private applyWardrobe() {
    const outfit = outfits.find((item) => item.id === this.state.wardrobe.outfitId) ?? outfits[0];
    const hat = accessories.find((item) => item.id === this.state.wardrobe.hatId);
    const shoes = accessories.find((item) => item.id === this.state.wardrobe.shoesId);
    const wings = accessories.find((item) => item.id === this.state.wardrobe.wingsId);
    this.bodyMaterial.color.set(outfit.body);
    this.skirtMaterial.color.set(outfit.skirt);
    this.shoeMaterial.color.set(shoes?.color ?? '#ffffff');
    this.hatGroup.clear();
    this.wingGroup.clear();
    if (hat && hat.id !== 'none-hat') this.hatGroup.add(this.createAccessoryMesh(hat));
    if (wings && wings.id !== 'none-wings') this.wingGroup.add(this.createAccessoryMesh(wings));
    saveState(this.state);
    this.uiDirty = true;
  }

  private createAccessoryMesh(item: Accessory) {
    const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.55, metalness: item.id === 'crown' ? 0.28 : 0 });
    const group = new THREE.Group();
    if (item.id === 'crown') {
      group.add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 32), material));
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), material);
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.25, 0.12, Math.sin(a) * 0.25);
        group.add(spike);
      }
    } else if (item.id === 'bunny') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 24), material);
      const ear1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 8, 12), material);
      const ear2 = ear1.clone();
      ear1.position.set(-0.18, 0.35, 0);
      ear1.rotation.z = -0.25;
      ear2.position.set(0.18, 0.35, 0);
      ear2.rotation.z = 0.25;
      group.add(band, ear1, ear2);
    } else if (item.id === 'butterfly') {
      const left = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), material);
      const right = left.clone();
      left.scale.set(0.65, 1.1, 0.12);
      left.position.x = -0.26;
      right.scale.set(0.65, 1.1, 0.12);
      right.position.x = 0.26;
      group.add(left, right);
    }
    return group;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.updatePlayer(dt);
    this.updateCamera(dt);
    this.updateCollectibles();
    this.findInteractable();
    this.checkInput();
    this.checkAchievements();
    this.renderUi();
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayer(dt: number) {
    const { forward, right } = this.input.axis;
    const dir = new THREE.Vector3(right, 0, -forward);
    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.player.position.addScaledVector(dir, dt * 5.2);
      this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -20, 20);
      this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -20, 20);
      this.player.rotation.y = Math.atan2(dir.x, dir.z);
    }
    this.player.position.y = Math.sin(performance.now() * 0.006) * 0.025;
  }

  private updateCamera(dt: number) {
    const target = new THREE.Vector3(this.player.position.x, 1.2, this.player.position.z);
    const desired = target.clone().add(new THREE.Vector3(0, 6.2, 8.8));
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(target);
  }

  private updateCollectibles() {
    const t = performance.now() * 0.001;
    for (const [id, mesh] of this.collectibleMeshes) {
      mesh.rotation.y += 0.025;
      mesh.position.y = 0.85 + Math.sin(t * 2.5 + id.length) * 0.12;
    }
  }

  private findInteractable() {
    const pos = this.player.position;
    let best: Interactable | null = null;
    for (const npc of npcs) {
      const d = pos.distanceTo(new THREE.Vector3(npc.x, 0, npc.z));
      if (d < 2.3 && (!best || d < best.distance)) best = { type: 'npc', id: npc.id, distance: d };
    }
    for (const item of collectibles) {
      if (this.state.collectedIds.includes(item.id)) continue;
      const d = pos.distanceTo(new THREE.Vector3(item.x, 0, item.z));
      if (d < 2.0 && (!best || d < best.distance)) best = { type: 'collectible', id: item.id, distance: d };
    }
    if (best?.id !== this.interactable?.id || best?.type !== this.interactable?.type) this.uiDirty = true;
    this.interactable = best;
  }

  private checkInput() {
    if (!this.input.consumeInteract) return;
    this.input.consumeInteract = false;
    if (!this.interactable) return;
    if (this.interactable.type === 'npc') this.talkToNpc(this.interactable.id);
    if (this.interactable.type === 'collectible') this.collectItem(this.interactable.id);
  }

  private talkToNpc(id: string) {
    const npc = npcs.find((item) => item.id === id) as Npc;
    if (!this.state.talkedNpcIds.includes(id)) this.state.talkedNpcIds.push(id);
    const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
    this.dialog = { name: `${npc.name} · ${npc.role}`, text: line };
    this.toastMessage(`已和 ${npc.name} 对话`);
    saveState(this.state);
    this.uiDirty = true;
  }

  private collectItem(id: string) {
    const item = collectibles.find((value) => value.id === id) as Collectible;
    this.state.collectedIds.push(id);
    const mesh = this.collectibleMeshes.get(id);
    if (mesh) this.scene.remove(mesh);
    this.collectibleMeshes.delete(id);
    this.dialog = null;
    this.toastMessage(`收集到：${item.name}`);
    saveState(this.state);
    this.uiDirty = true;
  }

  private setOutfit(id: string) {
    this.state.wardrobe.outfitId = id;
    if (!this.state.outfitHistory.includes(id)) this.state.outfitHistory.push(id);
    this.toastMessage(`换上：${outfits.find((item) => item.id === id)?.name ?? id}`);
    this.applyWardrobe();
  }

  private setAccessory(kind: Accessory['kind'], id: string) {
    if (kind === 'hat') this.state.wardrobe.hatId = id;
    if (kind === 'shoes') this.state.wardrobe.shoesId = id;
    if (kind === 'wings') this.state.wardrobe.wingsId = id;
    this.toastMessage('造型已更新');
    this.applyWardrobe();
  }

  private checkAchievements() {
    const before = this.state.achievements.length;
    for (const achievement of achievements) {
      if (this.state.achievements.includes(achievement.id)) continue;
      const value = this.getAchievementProgress(achievement.id);
      if (value >= achievement.target) {
        this.state.achievements.push(achievement.id);
        this.toastMessage(`达成成就：${achievement.title}`);
      }
    }
    if (this.state.achievements.length !== before) {
      saveState(this.state);
      this.uiDirty = true;
    }
  }

  private getQuestProgress(id: string) {
    if (id === 'first-talk') return Math.min(this.state.talkedNpcIds.length, 1);
    if (id === 'star-hunt') return this.state.collectedIds.filter((item) => item.startsWith('star')).length;
    if (id === 'fashion-day') return this.state.outfitHistory.length;
    return 0;
  }

  private getAchievementProgress(id: string) {
    if (id === 'collector') return this.state.collectedIds.length;
    if (id === 'social') return this.state.talkedNpcIds.length;
    if (id === 'stylist') return this.state.outfitHistory.length;
    return 0;
  }

  private toastMessage(message: string) {
    this.toast = message;
    this.toastUntil = performance.now() + 2300;
    this.uiDirty = true;
  }

  private renderUi() {
    if (this.toast && performance.now() > this.toastUntil) {
      this.toast = '';
      this.uiDirty = true;
    }
    if (!this.uiDirty) return;
    this.uiDirty = false;

    const collected = this.state.collectedIds.length;
    const talked = this.state.talkedNpcIds.length;
    const currentOutfit = outfits.find((item) => item.id === this.state.wardrobe.outfitId) as Outfit;
    const prompt = this.interactable ? `<div class="interact-prompt">按 E ${this.interactable.type === 'npc' ? '对话' : '收集'}</div>` : '';
    const dialog = this.dialog ? `<div class="dialog"><div class="dialog-name">${this.dialog.name}</div><div class="dialog-text">${this.dialog.text}</div></div>` : '';
    const toast = this.toast ? `<div class="toast">${this.toast}</div>` : '';
    const panel = this.panel === 'wardrobe' ? this.renderWardrobePanel() : this.panel === 'quests' ? this.renderQuestPanel() : '';

    this.uiRoot.innerHTML = `
      <div class="hud">
        ${toast}
        <section class="objective-chip">
          <div class="objective-title">冯以琳的换装小岛</div>
          <div class="objective-text">探索小岛，和 NPC 对话，收集隐藏星星。当前服装：${currentOutfit.name}。</div>
        </section>
        <div class="top-actions">
          <button class="action-button" data-action="wardrobe">换装</button>
          <button class="action-button" data-action="quests">任务</button>
          <button class="action-button" data-action="reset">重置存档</button>
        </div>
        ${panel}
        ${prompt}
        ${dialog}
        <div class="status-strip">
          <div class="status-pill">道具 ${collected}/${collectibles.length}</div>
          <div class="status-pill">朋友 ${talked}/${npcs.length}</div>
          <div class="status-pill">成就 ${this.state.achievements.length}/${achievements.length}</div>
        </div>
        <div class="controls-hint">WASD / 方向键移动 · E 互动 · 鼠标不需要操作</div>
      </div>`;

    this.bindUiEvents();
  }

  private renderWardrobePanel() {
    const outfitButtons = outfits.map((item) => `<button class="choice-button ${this.state.wardrobe.outfitId === item.id ? 'active' : ''}" data-outfit="${item.id}">${item.name}<br><small>${item.desc}</small></button>`).join('');
    const accessoryGroup = (kind: Accessory['kind'], title: string) => `
      <h3>${title}</h3><div class="grid">${accessories.filter((item) => item.kind === kind).map((item) => {
        const active = (kind === 'hat' && this.state.wardrobe.hatId === item.id) || (kind === 'shoes' && this.state.wardrobe.shoesId === item.id) || (kind === 'wings' && this.state.wardrobe.wingsId === item.id);
        return `<button class="choice-button ${active ? 'active' : ''}" data-accessory-kind="${kind}" data-accessory="${item.id}">${item.name}</button>`;
      }).join('')}</div>`;
    return `<section class="panel"><h2>换装衣柜</h2><h3>服饰</h3><div class="grid">${outfitButtons}</div>${accessoryGroup('hat', '帽子')}${accessoryGroup('shoes', '鞋子')}${accessoryGroup('wings', '翅膀')}</section>`;
  }

  private renderQuestPanel() {
    const questHtml = quests.map((quest) => {
      const progress = this.getQuestProgress(quest.id);
      const done = progress >= quest.target;
      return `<div class="quest-item ${done ? 'done' : ''}"><strong>${quest.title}</strong><br>${quest.description}<br>进度：${Math.min(progress, quest.target)}/${quest.target}</div>`;
    }).join('');
    const achievementHtml = achievements.map((achievement) => {
      const progress = this.getAchievementProgress(achievement.id);
      const done = this.state.achievements.includes(achievement.id);
      return `<div class="achievement-item ${done ? 'done' : ''}"><strong>${achievement.title}</strong><br>${achievement.description}<br>进度：${Math.min(progress, achievement.target)}/${achievement.target}</div>`;
    }).join('');
    return `<section class="panel"><h2>任务与成就</h2><h3>任务</h3>${questHtml}<h3>成就</h3>${achievementHtml}</section>`;
  }

  private bindUiEvents() {
    this.uiRoot.querySelectorAll<HTMLElement>('[data-action]').forEach((button) => {
      button.onclick = () => {
        const action = button.dataset.action;
        if (action === 'wardrobe') this.panel = this.panel === 'wardrobe' ? 'none' : 'wardrobe';
        if (action === 'quests') this.panel = this.panel === 'quests' ? 'none' : 'quests';
        if (action === 'reset') {
          this.state = resetState();
          location.reload();
          return;
        }
        this.uiDirty = true;
      };
    });
    this.uiRoot.querySelectorAll<HTMLElement>('[data-outfit]').forEach((button) => {
      button.onclick = () => this.setOutfit(button.dataset.outfit as string);
    });
    this.uiRoot.querySelectorAll<HTMLElement>('[data-accessory]').forEach((button) => {
      button.onclick = () => this.setAccessory(button.dataset.accessoryKind as Accessory['kind'], button.dataset.accessory as string);
    });
  }

  private resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };
}
