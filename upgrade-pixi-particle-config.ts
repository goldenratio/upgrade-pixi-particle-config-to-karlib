#!/usr/bin/env node

/**
 * Update pixi-particle v2 config to karlib particle config
 * @usage
 * ./upgrade-pixi-particle-config.ts [FILE] > particle_config.json
 */

// @ts-expect-error don't want to setup node/npm
import fs from "node:fs";
// @ts-expect-error don't want to setup node/npm
import path from "node:path";
// @ts-expect-error don't want to setup node/npm
import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

// @ts-expect-error don't want to setup node/npm
const config_input = process?.argv[2];

if (typeof config_input === "string") {
  const pkgPath = path.resolve(config_input);
  const config_json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const upgraded_config = JSON.parse(JSON.stringify(upgradeConfig(config_json)));
  console.log(JSON.stringify(upgraded_config, undefined, 2));
}

/**
 * Emitter Config is based on pixi-particle
 * https://github.com/pixijs-userland/particle-emitter
 */
export interface EmitterConfig {
  /**
   * Default position to spawn particles from inside the parent container.
   */
  readonly pos: { x: number; y: number };
  /**
   * Random number configuration for picking the lifetime for each particle..
   */
  readonly lifetime: EmitterRandNumber;
  /**
   * How often to spawn particles. This is a value in seconds, so a value of 0.5 would be twice a second.
   */
  readonly frequency: number;
  /**
   * How many particles to spawn at once, each time that it is determined that particles should be spawned.
   * If omitted, only one particle will spawn at a time.
   */
  readonly particles_per_wave?: number;
  /**
   * How long to run the Emitter before it stops spawning particles. If omitted, runs forever (or until told to stop
   * manually).
   * @default -1
   */
  readonly emitter_lifetime?: number;
  /**
   * Maximum number of particles that can be alive at any given time for this emitter.
   * @default 20
   */
  readonly max_particles?: number;
  /**
   * If the emitter should start out emitting particles. If omitted, it will be treated as `true` and will emit particles
   * immediately.
   * @default true
   */
  readonly emit?: boolean;
  /**
   * The list of behaviors to apply to this emitter.
   */
  behaviors: BehaviorEntryType[];
}

export interface EmitterConfigValue<TValue> {
  readonly time: number;
  readonly value: TValue;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

type AnimFrame = {
  readonly textures: readonly string[];
  /**
   * in milliseconds
   * @default 100
   **/
  readonly frame_duration?: number;
  readonly loop?: boolean;
}

export type BehaviorEntryType =
  // textures
  | { readonly type: "textureSingle"; readonly config: { readonly texture: string } }
  | { readonly type: "textureRandom"; readonly config: { readonly textures: readonly string[] } }
  | { readonly type: "animatedSingle"; readonly config: { readonly anim: AnimFrame } }
  | { readonly type: "animatedRandom"; readonly config: { readonly anims: AnimFrame[] } }
  // properties
  | { readonly type: "color"; readonly config: { readonly color: { readonly list: readonly EmitterConfigValue<string>[] } } }
  | { readonly type: "colorStatic"; readonly config: { readonly color: string } }
  | { readonly type: "scale"; readonly config: { readonly scale: { readonly list: readonly EmitterConfigValue<number>[] }; readonly min_mult: number } }
  | { readonly type: "scaleStatic"; readonly config: EmitterRandNumber }
  | { readonly type: "moveSpeed"; readonly config: { readonly speed: { readonly list: readonly EmitterConfigValue<number>[] }; readonly min_mult: number } }
  | { readonly type: "moveSpeedStatic"; readonly config: EmitterRandNumber }
  | { readonly type: "moveAcceleration"; readonly config: { readonly min_start: number; readonly max_start: number; readonly rotate: boolean; readonly accel: Point; readonly max_speed: number } }
  | { readonly type: "alpha"; readonly config: { readonly alpha: { readonly list: readonly EmitterConfigValue<number>[] } } }
  | { readonly type: "alphaStatic"; readonly config: { readonly alpha: number } }
  | { readonly type: "noRotation"; readonly config: {} }
  | { readonly type: "rotation"; readonly config: { readonly min_start: number; readonly max_start: number; readonly min_speed: number; readonly max_speed: number; readonly accel: number } }
  | { readonly type: "rotationStatic"; readonly config: EmitterRandNumber }
  // emitter configs
  | { readonly type: "spawnPoint"; readonly config: {} }
  | { readonly type: "spawnBurst"; readonly config: { readonly start: number; readonly spacing: number; } }
  | {
    readonly type: "spawnShape"; readonly config:
    | { readonly type: "rect"; readonly data: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } }
    | { readonly type: "torus"; readonly data: { readonly x: number; readonly y: number; readonly radius: number; readonly inner_radius: number; readonly affect_rotation: boolean } };
  };

/**
 * Configuration for how to pick a random number (inclusive).
 */
export interface EmitterRandNumber {
  /**
   * Maximum pickable value.
   */
  readonly max: number;
  /**
   * Minimum pickable value.
   */
  readonly min: number;
}

function upgradeConfig(config: any, art: any = "particle"): EmitterConfig {
  // just ensure we aren't given any V3 config data
  if ('behaviors' in config) {
    return config;
  }

  const out: EmitterConfig = {
    lifetime: config.lifetime,
    // ease: config.ease,
    particles_per_wave: config.particlesPerWave,
    frequency: config.frequency,
    // spawn_chance: config.spawnChance,
    emitter_lifetime: config.emitterLifetime,
    max_particles: config.maxParticles,
    // add_at_back: config.addAtBack,
    pos: config.pos,
    emit: config.emit,
    // autoUpdate: config.autoUpdate,
    behaviors: [],
  };

  // set up the alpha
  if (config.alpha) {
    if ('start' in config.alpha) {
      if (config.alpha.start === config.alpha.end) {
        if (config.alpha.start !== 1) {
          out.behaviors.push({
            type: 'alphaStatic',
            config: { alpha: config.alpha.start },
          });
        }
      }
      else {
        const list = {
          list: [
            { time: 0, value: config.alpha.start },
            { time: 1, value: config.alpha.end },
          ],
        };

        out.behaviors.push({
          type: 'alpha',
          config: { alpha: list },
        });
      }
    }
    else if (config.alpha.list.length === 1) {
      if (config.alpha.list[0].value !== 1) {
        out.behaviors.push({
          type: 'alphaStatic',
          config: { alpha: config.alpha.list[0].value },
        });
      }
    }
    else {
      out.behaviors.push({
        type: 'alpha',
        config: { alpha: config.alpha },
      });
    }
  }

  // acceleration movement
  if (config.acceleration && (config.acceleration.x || config.acceleration.y)) {
    let minStart: number;
    let maxStart: number;

    if ('start' in config.speed) {
      minStart = config.speed.start * (config.speed.minimumSpeedMultiplier ?? 1);
      maxStart = config.speed.start;
    }
    else {
      minStart = config.speed.list[0].value * ((config).minimumSpeedMultiplier ?? 1);
      maxStart = config.speed.list[0].value;
    }

    out.behaviors.push({
      type: 'moveAcceleration',
      config: {
        accel: config.acceleration,
        min_start: minStart,
        max_start: maxStart,
        rotate: !config.noRotation,
        max_speed: config.maxSpeed,
      },
    });
  }
  // path movement
  else if (config.extraData?.path) {
    let list;
    let mult: number;

    if ('start' in config.speed) {
      mult = config.speed.minimumSpeedMultiplier ?? 1;
      if (config.speed.start === config.speed.end) {
        list = {
          list: [{ time: 0, value: config.speed.start }],
        };
      }
      else {
        list = {
          list: [
            { time: 0, value: config.speed.start },
            { time: 1, value: config.speed.end },
          ],
        };
      }
    }
    else {
      list = config.speed;
      mult = ((config).minimumSpeedMultiplier ?? 1);
    }

    out.behaviors.push({
      type: 'movePath',
      config: {
        path: config.extraData.path,
        speed: list,
        minMult: mult,
      },
    });
  }
  // normal speed movement
  else {
    if (config.speed) {
      if ('start' in config.speed) {
        if (config.speed.start === config.speed.end) {
          out.behaviors.push({
            type: 'moveSpeedStatic',
            config: {
              min: config.speed.start * (config.speed.minimumSpeedMultiplier ?? 1),
              max: config.speed.start,
            },
          });
        }
        else {
          const list = {
            list: [
              { time: 0, value: config.speed.start },
              { time: 1, value: config.speed.end },
            ],
          };

          out.behaviors.push({
            type: 'moveSpeed',
            config: { speed: list, min_mult: config.speed.minimumSpeedMultiplier },
          });
        }
      }
      else if (config.speed.list.length === 1) {
        out.behaviors.push({
          type: 'moveSpeedStatic',
          config: {
            min: config.speed.list[0].value * ((config).minimumSpeedMultiplier ?? 1),
            max: config.speed.list[0].value,
          },
        });
      }
      else {
        out.behaviors.push({
          type: 'moveSpeed',
          config: { speed: config.speed, min_mult: ((config).minimumSpeedMultiplier ?? 1) },
        });
      }
    }
  }

  // scale
  if (config.scale) {
    if ('start' in config.scale) {
      const mult = config.scale.minimumScaleMultiplier ?? 1;

      if (config.scale.start === config.scale.end) {
        out.behaviors.push({
          type: 'scaleStatic',
          config: {
            min: config.scale.start * mult,
            max: config.scale.start,
          },
        });
      }
      else {
        const list = {
          list: [
            { time: 0, value: config.scale.start },
            { time: 1, value: config.scale.end },
          ],
        };

        out.behaviors.push({
          type: 'scale',
          config: { scale: list, min_mult: mult },
        });
      }
    }
    else if (config.scale.list.length === 1) {
      const mult = (config).minimumScaleMultiplier ?? 1;
      const scale = config.scale.list[0].value;

      out.behaviors.push({
        type: 'scaleStatic',
        config: { min: scale * mult, max: scale },
      });
    }
    else {
      out.behaviors.push({
        type: 'scale',
        config: { scale: config.scale, min_mult: (config).minimumScaleMultiplier ?? 1 },
      });
    }
  }

  // color
  if (config.color) {
    if ('start' in config.color) {
      if (config.color.start === config.color.end) {
        if (config.color.start !== 'ffffff') {
          out.behaviors.push({
            type: 'colorStatic',
            config: { color: config.color.start },
          });
        }
      }
      else {
        const list = {
          list: [
            { time: 0, value: config.color.start },
            { time: 1, value: config.color.end },
          ],
        };

        out.behaviors.push({
          type: 'color',
          config: { color: list },
        });
      }
    }
    else if (config.color.list.length === 1) {
      if (config.color.list[0].value !== 'ffffff') {
        out.behaviors.push({
          type: 'colorStatic',
          config: { color: config.color.list[0].value },
        });
      }
    }
    else {
      out.behaviors.push({
        type: 'color',
        config: { color: config.color },
      });
    }
  }

  // rotation
  if (config.rotationAcceleration || config.rotationSpeed?.min || config.rotationSpeed?.max) {
    out.behaviors.push({
      type: 'rotation',
      config: {
        accel: config.rotationAcceleration || 0,
        min_speed: config.rotationSpeed?.min || 0,
        max_speed: config.rotationSpeed?.max || 0,
        min_start: config.startRotation?.min || 0,
        max_start: config.startRotation?.max || 0,
      },
    });
  }
  else if (config.startRotation?.min || config.startRotation?.max) {
    out.behaviors.push({
      type: 'rotationStatic',
      config: {
        min: config.startRotation?.min || 0,
        max: config.startRotation?.max || 0,
      },
    });
  }
  if (config.noRotation) {
    out.behaviors.push({
      type: 'noRotation',
      config: {},
    });
  }

  // blend mode
  if (config.blendMode && config.blendMode !== 'normal') {
    out.behaviors.push({
      type: 'blendMode',
      config: {
        blendMode: config.blendMode,
      },
    });
  }

  // animated
  if (Array.isArray(art) && typeof art[0] !== 'string' && 'framerate' in art[0]) {
    for (let i = 0; i < art.length; ++i) {
      if (art[i].framerate === 'matchLife') {
        art[i].framerate = -1;
      }
    }
    out.behaviors.push({
      type: 'animatedRandom',
      config: {
        anims: art.map(value => ({ textures: value.textures, frame_duration: 100, loop: true, })),
      },
    });
  }
  else if (typeof art !== 'string' && 'framerate' in art) {
    if (art.framerate === 'matchLife') {
      art.framerate = -1;
    }
    out.behaviors.push({
      type: 'animatedSingle',
      config: {
        anim: {
          textures: art.textures,
          frame_duration: 100,
          loop: true,
        },
      },
    });
  }
  // ordered art
  else if (config.orderedArt && Array.isArray(art)) {
    out.behaviors.push({
      type: 'textureOrdered',
      config: {
        textures: art,
      },
    });
  }
  // random texture
  else if (Array.isArray(art)) {
    out.behaviors.push({
      type: 'textureRandom',
      config: {
        textures: art,
      },
    });
  }
  // single texture
  else {
    out.behaviors.push({
      type: 'textureSingle',
      config: {
        texture: art,
      },
    });
  }

  // spawn burst
  if (config.spawnType === 'burst') {
    out.behaviors.push({
      type: 'spawnBurst',
      config: {
        start: config.angleStart || 0,
        spacing: config.particleSpacing,
        // older formats bursted from a single point
        // distance: 0,
      },
    });
  }
  // spawn point
  else if (config.spawnType === 'point') {
    out.behaviors.push({
      type: 'spawnPoint',
      config: {},
    });
  }
  // spawn shape
  else {
    let shape: any;

    if (config.spawnType === 'ring') {
      shape = {
        type: 'torus',
        data: {
          x: config.spawnCircle.x,
          y: config.spawnCircle.y,
          radius: config.spawnCircle.r,
          innerRadius: config.spawnCircle.minR,
          affectRotation: true,
        },
      };
    }
    else if (config.spawnType === 'circle') {
      shape = {
        type: 'torus',
        data: {
          x: config.spawnCircle.x,
          y: config.spawnCircle.y,
          radius: config.spawnCircle.r,
          innerRadius: 0,
          affectRotation: false,
        },
      };
    }
    else if (config.spawnType === 'rect') {
      shape = {
        type: 'rect',
        data: config.spawnRect,
      };
    }
    else if (config.spawnType === 'polygonalChain') {
      shape = {
        type: 'polygonalChain',
        data: config.spawnPolygon,
      };
    }

    if (shape) {
      out.behaviors.push({
        type: 'spawnShape',
        config: shape,
      });
    }
  }

  return out;
}
