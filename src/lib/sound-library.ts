// Curated free-to-use audio. SoundHelix is a long-standing source of CC-friendly
// algorithmic music samples used widely in demos.
export type LibrarySound = {
  id: string;
  name: string;
  category: "music" | "sfx" | "ambient";
  url: string;
  duration: number; // approximate seconds for UI; real duration probed on add
};

export const SOUND_LIBRARY: LibrarySound[] = [
  { id: "sh-1", name: "Upbeat Loop", category: "music", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: 372 },
  { id: "sh-2", name: "Electronic Drive", category: "music", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: 425 },
  { id: "sh-3", name: "Chill Synth", category: "music", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", duration: 410 },
  { id: "sh-7", name: "Cinematic", category: "music", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", duration: 422 },
  { id: "sh-11", name: "Dreamy Piano", category: "ambient", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3", duration: 410 },
  { id: "sh-16", name: "Lo-Fi Beats", category: "music", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3", duration: 410 },
];
