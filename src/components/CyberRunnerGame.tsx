import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  X,
  Trophy,
  Award,
  Zap,
  Shield,
  Sparkles,
  Flame,
  ChevronLeft,
} from 'lucide-react';
import { UserAccount } from '../types/blin';
import { apiRequest } from '../lib/api';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface CyberRunnerGameProps {
  user: UserAccount;
  onClose: () => void;
  onPointsUpdated?: () => void;
}

// Procedural Web Audio Synthesizer
class SoundSynth {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playLaser() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playCollect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.15, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.1);
    });
  }

  playPowerup() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playGameOver() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }
}

const synth = new SoundSynth();

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: 'drone' | 'speeder' | 'pulse_boss';
  hp: number;
}

interface Orb {
  x: number;
  y: number;
  radius: number;
  color: string;
  type: 'points' | 'shield' | 'blaster';
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export function CyberRunnerGame({ user, onClose, onPointsUpdated }: CyberRunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game UI State
  const [gameState, setGameState] = useState<'title' | 'playing' | 'gameover'>('title');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [shield, setShield] = useState(100);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [topScores, setTopScores] = useState<any[]>([]);

  // Simulation references (separated continuous held vs edge-triggered justPressed)
  const keysHeld = useRef<Set<string>>(new Set());
  const keysJustPressed = useRef<Set<string>>(new Set());
  const touchX = useRef<number | null>(null);
  const isShootingTouch = useRef<boolean>(false);

  // Entities state in ref for 60fps simulation decoupled from React render tree
  const sim = useRef({
    player: {
      x: 400,
      y: 600,
      vx: 0,
      vy: 0,
      radius: 18,
      speed: 460,
      shield: 100,
      invulnerable: 0,
    },
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    orbs: [] as Orb[],
    particles: [] as Particle[],
    screenShake: 0,
    hitstopTimer: 0,
    shootCooldown: 0,
    spawnTimer: 0,
    score: 0,
    wave: 1,
    multiplier: 1,
    multiplierTimer: 0,
    startTime: 0,
    lastTime: 0,
  });

  // Load high scores on mount
  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const res = await apiRequest<any[]>('/api/game/leaderboard');
        setTopScores(res);
      } catch (e) {
        // ignore
      }
    }
    loadLeaderboard();
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
      if (!keysHeld.current.has(e.code)) {
        keysJustPressed.current.add(e.code);
      }
      keysHeld.current.add(e.code);
    }

    function handleKeyUp(e: KeyboardEvent) {
      keysHeld.current.delete(e.code);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Audio mute sync
  function toggleAudio() {
    synth.enabled = !audioEnabled;
    setAudioEnabled(!audioEnabled);
  }

  // Start / Restart Game
  function startGame() {
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 800;
    const height = canvas ? canvas.height : 600;

    sim.current = {
      player: {
        x: width / 2,
        y: height - 100,
        vx: 0,
        vy: 0,
        radius: 18,
        speed: 480,
        shield: 100,
        invulnerable: 0.5,
      },
      bullets: [],
      enemies: [],
      orbs: [],
      particles: [],
      screenShake: 0,
      hitstopTimer: 0,
      shootCooldown: 0,
      spawnTimer: 0,
      score: 0,
      wave: 1,
      multiplier: 1,
      multiplierTimer: 0,
      startTime: Date.now(),
      lastTime: performance.now(),
    };

    setScore(0);
    setWave(1);
    setMultiplier(1);
    setShield(100);
    setPointsEarned(0);
    setGameState('playing');
    synth.playPowerup();
  }

  // Submit high score to server and Firestore
  async function submitGameScore(finalScore: number, finalWave: number) {
    setSubmittingScore(true);
    const duration = Math.max(1, Math.round((Date.now() - sim.current.startTime) / 1000));
    try {
      // 1. Authoritative server check & BLiN points award
      const res = await apiRequest<{
        success: boolean;
        pointsEarned: number;
        pointsBalance: number;
        leaderboard: any[];
      }>('/api/game/record-score', {
        method: 'POST',
        body: JSON.stringify({
          score: finalScore,
          wave: finalWave,
          playDurationSec: duration,
        }),
      });

      setPointsEarned(res.pointsEarned);
      setTopScores(res.leaderboard);
      if (onPointsUpdated) onPointsUpdated();

      // 2. Persist to Firestore collection `game_scores` adhering to firebase-integration-rpc
      try {
        await addDoc(collection(db, 'game_scores'), {
          userId: user.id,
          displayName: user.displayName,
          score: finalScore,
          gameMode: 'cyber_runner',
          pointsAwarded: res.pointsEarned,
          createdAt: new Date().toISOString(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, 'game_scores');
      }
    } catch (err) {
      console.error('Failed to submit score:', err);
    } finally {
      setSubmittingScore(false);
    }
  }

  // 60FPS Simulation Loop with Delta Clamping
  useEffect(() => {
    let animId: number;

    function loop(now: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rawDt = (now - sim.current.lastTime) / 1000;
      sim.current.lastTime = now;
      // Clamped delta per game craft rules: Math.min(rawDt, 0.05)
      const dt = Math.min(rawDt, 0.05);

      if (gameState === 'playing') {
        updateSimulation(dt, canvas.width, canvas.height);
      }

      render(ctx, canvas.width, canvas.height);
      keysJustPressed.current.clear();
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  // Update Game Physics
  function updateSimulation(dt: number, width: number, height: number) {
    const s = sim.current;

    // Hitstop freeze handling
    if (s.hitstopTimer > 0) {
      s.hitstopTimer -= dt;
      return;
    }

    // Screen shake decay
    if (s.screenShake > 0) {
      s.screenShake = Math.max(0, s.screenShake - dt * 25);
    }

    // Multiplier timer decay
    if (s.multiplierTimer > 0) {
      s.multiplierTimer -= dt;
      if (s.multiplierTimer <= 0 && s.multiplier > 1) {
        s.multiplier = Math.max(1, s.multiplier - 1);
        setMultiplier(s.multiplier);
      }
    }

    // Invulnerability timer
    if (s.player.invulnerable > 0) {
      s.player.invulnerable -= dt;
    }

    // Player Movement (held inputs)
    let moveX = 0;
    let moveY = 0;
    if (keysHeld.current.has('ArrowLeft') || keysHeld.current.has('KeyA')) moveX -= 1;
    if (keysHeld.current.has('ArrowRight') || keysHeld.current.has('KeyD')) moveX += 1;
    if (keysHeld.current.has('ArrowUp') || keysHeld.current.has('KeyW')) moveY -= 1;
    if (keysHeld.current.has('ArrowDown') || keysHeld.current.has('KeyS')) moveY += 1;

    // Touch control support
    if (touchX.current !== null) {
      const diff = touchX.current - s.player.x;
      if (Math.abs(diff) > 8) {
        moveX = Math.sign(diff);
      }
    }

    // Normalize diagonal
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    s.player.x += moveX * s.player.speed * dt;
    s.player.y += moveY * s.player.speed * dt;

    // Clamp inside viewport
    s.player.x = Math.max(s.player.radius, Math.min(width - s.player.radius, s.player.x));
    s.player.y = Math.max(s.player.radius + 60, Math.min(height - s.player.radius, s.player.y));

    // Player Shooting (Continuous held or touch)
    s.shootCooldown -= dt;
    const wantsToShoot =
      keysHeld.current.has('Space') ||
      keysJustPressed.current.has('Space') ||
      isShootingTouch.current;

    if (wantsToShoot && s.shootCooldown <= 0) {
      s.shootCooldown = 0.14; // rapid fire rate
      s.bullets.push({
        x: s.player.x,
        y: s.player.y - s.player.radius - 4,
        vx: 0,
        vy: -750,
        radius: 4,
      });
      synth.playLaser();
    }

    // Update Bullets
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const b = s.bullets[i];
      b.y += b.vy * dt;
      if (b.y < -10) {
        s.bullets.splice(i, 1);
      }
    }

    // Spawn Enemies based on Wave
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      const spawnInterval = Math.max(0.45, 1.4 - s.wave * 0.12);
      s.spawnTimer = spawnInterval;

      const roll = Math.random();
      let enemyType: 'drone' | 'speeder' | 'pulse_boss' = 'drone';
      let enemyRadius = 16;
      let hp = 1;
      let speed = 180 + s.wave * 15;
      let color = '#EC4899';

      if (roll > 0.85 && s.wave >= 2) {
        enemyType = 'pulse_boss';
        enemyRadius = 26;
        hp = 4;
        speed = 110;
        color = '#A855F7';
      } else if (roll > 0.6) {
        enemyType = 'speeder';
        enemyRadius = 14;
        hp = 1;
        speed = 280 + s.wave * 20;
        color = '#06B6D4';
      }

      s.enemies.push({
        x: Math.random() * (width - 60) + 30,
        y: -30,
        vx: (Math.random() - 0.5) * 60,
        vy: speed,
        radius: enemyRadius,
        color,
        type: enemyType,
        hp,
      });
    }

    // Update Enemies & Bullet Collisions
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const enemy = s.enemies[i];
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Bounce off walls
      if (enemy.x - enemy.radius < 0 || enemy.x + enemy.radius > width) {
        enemy.vx *= -1;
      }

      // Check bullet collision
      for (let j = s.bullets.length - 1; j >= 0; j--) {
        const bullet = s.bullets[j];
        const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
        if (dist < enemy.radius + bullet.radius) {
          s.bullets.splice(j, 1);
          enemy.hp -= 1;

          // Spawn particle spark
          createSparks(bullet.x, bullet.y, enemy.color, 6);

          if (enemy.hp <= 0) {
            // Defeated!
            createSparks(enemy.x, enemy.y, enemy.color, 24);
            synth.playHit();
            s.enemies.splice(i, 1);

            // Add score with multiplier
            const pts = (enemy.type === 'pulse_boss' ? 500 : 150) * s.multiplier;
            s.score += pts;
            setScore(s.score);

            // Increase multiplier & timer
            s.multiplier = Math.min(10, s.multiplier + 1);
            s.multiplierTimer = 4.0;
            setMultiplier(s.multiplier);

            // Screen shake
            s.screenShake = 6;
            // Hitstop juiciness on boss kill
            if (enemy.type === 'pulse_boss') s.hitstopTimer = 0.06;

            // Orb drop chance
            if (Math.random() > 0.4) {
              s.orbs.push({
                x: enemy.x,
                y: enemy.y,
                radius: 10,
                color: Math.random() > 0.8 ? '#10B981' : '#F59E0B',
                type: Math.random() > 0.8 ? 'shield' : 'points',
              });
            }

            // Check wave progression
            if (s.score > s.wave * 2500) {
              s.wave += 1;
              setWave(s.wave);
              s.screenShake = 10;
              synth.playCollect();
            }
            break;
          }
        }
      }

      // Enemy past bottom
      if (enemy.y > height + 40) {
        s.enemies.splice(i, 1);
      } else {
        // Player collision
        if (s.player.invulnerable <= 0) {
          const pDist = Math.hypot(enemy.x - s.player.x, enemy.y - s.player.y);
          if (pDist < enemy.radius + s.player.radius) {
            // Player hit!
            s.enemies.splice(i, 1);
            createSparks(s.player.x, s.player.y, '#EF4444', 30);
            s.player.shield -= enemy.type === 'pulse_boss' ? 40 : 25;
            s.player.invulnerable = 1.0;
            s.screenShake = 16;
            s.hitstopTimer = 0.08;
            setShield(Math.max(0, s.player.shield));
            synth.playHit();

            if (s.player.shield <= 0) {
              // Game Over!
              synth.playGameOver();
              setGameState('gameover');
              if (s.score > highScore) setHighScore(s.score);
              submitGameScore(s.score, s.wave);
            }
          }
        }
      }
    }

    // Update Orbs
    for (let i = s.orbs.length - 1; i >= 0; i--) {
      const orb = s.orbs[i];
      orb.y += 120 * dt;

      const pDist = Math.hypot(orb.x - s.player.x, orb.y - s.player.y);
      if (pDist < orb.radius + s.player.radius + 10) {
        // Collect orb!
        s.orbs.splice(i, 1);
        synth.playCollect();
        createSparks(orb.x, orb.y, orb.color, 12);
        if (orb.type === 'shield') {
          s.player.shield = Math.min(100, s.player.shield + 20);
          setShield(s.player.shield);
        } else {
          s.score += 250 * s.multiplier;
          setScore(s.score);
        }
      } else if (orb.y > height + 20) {
        s.orbs.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        s.particles.splice(i, 1);
      }
    }
  }

  function createSparks(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 260 + 40;
      sim.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.4 + 0.2,
        maxLife: 0.6,
        color,
        size: Math.random() * 4 + 2,
      });
    }
  }

  // Render to 60fps Canvas
  function render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const s = sim.current;

    ctx.save();

    // Screen Shake Offset
    if (s.screenShake > 0) {
      const dx = (Math.random() - 0.5) * s.screenShake * 2;
      const dy = (Math.random() - 0.5) * s.screenShake * 2;
      ctx.translate(dx, dy);
    }

    // Clear Deep Cyber Background
    ctx.fillStyle = '#060417';
    ctx.fillRect(0, 0, width, height);

    // Perspective Cyber Grid Lines (Juicy motion feeling)
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
    ctx.lineWidth = 1;
    const gridOffset = (performance.now() * 0.15) % 40;
    for (let y = gridOffset; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Render Particles
    for (const p of s.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Orbs
    for (const orb of s.orbs) {
      ctx.save();
      ctx.fillStyle = orb.color;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Bullets
    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 10;
    for (const b of s.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Render Enemies
    for (const enemy of s.enemies) {
      ctx.save();
      ctx.fillStyle = enemy.color;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 14;

      if (enemy.type === 'pulse_boss') {
        // Hexagonal boss ship
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (a * Math.PI) / 3;
          const ex = enemy.x + Math.cos(angle) * enemy.radius;
          const ey = enemy.y + Math.sin(angle) * enemy.radius;
          if (a === 0) ctx.moveTo(ex, ey);
          else ctx.lineTo(ex, ey);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Triangle cyber fighter
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y + enemy.radius);
        ctx.lineTo(enemy.x - enemy.radius, enemy.y - enemy.radius);
        ctx.lineTo(enemy.x + enemy.radius, enemy.y - enemy.radius);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Render Player Ship
    if (gameState === 'playing' || gameState === 'title') {
      const p = s.player;
      ctx.save();
      if (p.invulnerable > 0 && Math.floor(performance.now() / 60) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }
      ctx.fillStyle = '#EC4899';
      ctx.shadowColor = '#EC4899';
      ctx.shadowBlur = 18;

      // Stylized Arrowhead Starfighter
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.radius * 1.3);
      ctx.lineTo(p.x - p.radius * 1.1, p.y + p.radius * 1.1);
      ctx.lineTo(p.x, p.y + p.radius * 0.5);
      ctx.lineTo(p.x + p.radius * 1.1, p.y + p.radius * 1.1);
      ctx.closePath();
      ctx.fill();

      // Cockpit Glow
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Shield Aura
      if (p.shield > 25) {
        ctx.strokeStyle = `rgba(6, 182, 212, ${p.shield / 150})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // Handle Canvas Resize
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#060417] text-white overflow-hidden select-none touch-none flex flex-col justify-between">
      {/* 60FPS Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair z-0"
        onPointerDown={(e) => {
          touchX.current = e.clientX;
          isShootingTouch.current = true;
        }}
        onPointerMove={(e) => {
          if (touchX.current !== null) {
            touchX.current = e.clientX;
          }
        }}
        onPointerUp={() => {
          touchX.current = null;
          isShootingTouch.current = false;
        }}
        onPointerCancel={() => {
          touchX.current = null;
          isShootingTouch.current = false;
        }}
      />

      {/* =========================================================================
          LOW-OCCLUSION FLOATING HUD (Keeps >=85% unobstructed per Game Craft Rules)
         ========================================================================= */}
      <div className="relative z-20 pointer-events-none p-4 flex items-start justify-between">
        {/* Top Left: Score, Multiplier & Wave */}
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur border border-white/20 hover:border-pink-500/50 flex items-center justify-center text-white transition-colors"
            title="Exit Arcade"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="bg-black/60 backdrop-blur border border-white/15 px-3.5 py-1.5 rounded-2xl flex items-center gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">SCORE</p>
              <p className="text-lg font-black font-mono tracking-tight text-white">{score.toLocaleString()}</p>
            </div>

            {multiplier > 1 && (
              <div className="px-2 py-0.5 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300 font-black text-xs animate-bounce">
                {multiplier}x
              </div>
            )}

            <div className="border-l border-white/10 pl-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">WAVE</p>
              <p className="text-base font-bold font-mono text-cyan-300">{wave}</p>
            </div>
          </div>
        </div>

        {/* Top Right: Shield Bar & Audio Toggle */}
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="bg-black/60 backdrop-blur border border-white/15 px-3 py-1.5 rounded-2xl flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            <div className="w-24 sm:w-32 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-300 ${
                  shield > 50 ? 'bg-cyan-400' : shield > 25 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
                }`}
                style={{ width: `${shield}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-slate-200">{shield}%</span>
          </div>

          <button
            type="button"
            onClick={toggleAudio}
            className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur border border-white/15 hover:border-cyan-400 flex items-center justify-center text-slate-200 transition-colors"
            title={audioEnabled ? 'Mute SFX' : 'Enable SFX'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          TITLE SCREEN OVERLAY (With Bespoke Inline SVG Title Lockup)
         ========================================================================= */}
      {gameState === 'title' && (
        <div className="relative z-30 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center bg-black/70 backdrop-blur-md">
          <div className="max-w-md w-full space-y-6">
            {/* Bespoke inline SVG Title Lockup */}
            <div className="flex justify-center">
              <svg viewBox="0 0 460 90" className="w-full max-w-sm drop-shadow-[0_0_24px_rgba(236,72,153,0.6)]">
                <defs>
                  <linearGradient id="cyberTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#EC4899" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
                <text
                  x="50%"
                  y="45"
                  textAnchor="middle"
                  fill="url(#cyberTitleGrad)"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="900"
                  fontSize="38"
                  letterSpacing="4"
                >
                  CYBER RUNNER
                </text>
                <text
                  x="50%"
                  y="75"
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontFamily="monospace"
                  fontWeight="700"
                  fontSize="13"
                  letterSpacing="6"
                >
                  // BLiN PULSE GRID ARCADE //
                </text>
              </svg>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Blast rogue drones, dodge pulse waves, collect energy cores, and earn real BLiN Points stored on Firebase!
            </p>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400 space-y-1">
              <p className="text-cyan-300 font-bold">🎮 Controls:</p>
              <p>Move: <span className="text-white font-mono font-bold">WASD / Arrow Keys / Drag</span></p>
              <p>Fire Blaster: <span className="text-white font-mono font-bold">Spacebar / Touch & Hold</span></p>
            </div>

            <button
              type="button"
              onClick={startGame}
              className="w-full py-4 rounded-2xl blin-cta-gradient text-white font-display font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-pink-500/30 hover:scale-105 active:scale-95 transition-transform"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>START RUN</span>
            </button>

            {/* Quick Leaderboard Preview */}
            {topScores.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-1 border-b border-white/10">
                  <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-400" /> TOP PILOTS</span>
                  <span>SCORE</span>
                </div>
                <div className="divide-y divide-white/5 text-xs max-h-24 overflow-y-auto">
                  {topScores.slice(0, 3).map((s, idx) => (
                    <div key={s.id || idx} className="py-1 flex items-center justify-between">
                      <span className="text-slate-300 font-bold">{idx + 1}. {s.displayName}</span>
                      <span className="font-mono text-cyan-300">{s.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          GAME OVER SCREEN OVERLAY
         ========================================================================= */}
      {gameState === 'gameover' && (
        <div className="relative z-30 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center bg-black/80 backdrop-blur-lg">
          <div className="max-w-md w-full space-y-5 bg-[#0a071e]/90 p-6 sm:p-8 rounded-3xl border border-pink-500/30 shadow-2xl">
            <h2 className="font-display font-black text-3xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-pink-500">
              MISSION FAILED
            </h2>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-slate-400 font-mono font-bold uppercase">FINAL SCORE</p>
                <p className="text-xl font-black font-mono text-white">{score.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-slate-400 font-mono font-bold uppercase">WAVE REACHED</p>
                <p className="text-xl font-black font-mono text-cyan-300">{wave}</p>
              </div>
            </div>

            {/* Points Awarded Banner */}
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-400" />
                <span className="text-slate-200 font-semibold">BLiN Points Earned:</span>
              </div>
              <span className="font-mono font-black text-cyan-300 text-sm">
                +{pointsEarned} PTS
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={startGame}
                className="flex-1 py-3.5 rounded-xl blin-cta-gradient text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>PLAY AGAIN</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-sm"
              >
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Hint */}
      <div className="relative z-20 pointer-events-none p-3 text-center text-[11px] text-slate-500 font-mono">
        {gameState === 'playing' ? 'Dodge drones · Fire with Spacebar or Touch · Score points for BLiN' : 'BLiN Cyber Arcade · 60 FPS Web Audio Engine'}
      </div>
    </div>
  );
}
