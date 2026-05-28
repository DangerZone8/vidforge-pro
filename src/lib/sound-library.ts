// Curated free-to-use audio. SoundHelix is a long-standing source of CC-friendly
// algorithmic music samples used widely in demos.
export type LibrarySound = {
  id: string;
  name: string;
  category: "music" | "sfx" | "ambient";
  url: string;
  duration: number; // approximate seconds for UI; real duration probed on add
};

// Pre-given sounds from SoundHelix library - all directly fetchable
export const SOUND_LIBRARY: LibrarySound[] = [
  {
    id: "sh-1",
    name: "Upbeat Loop",
    category: "music",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 372,
  },
  {
    id: "sh-2",
    name: "Electronic Drive",
    category: "music",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 425,
  },
  {
    id: "sh-3",
    name: "Chill Synth",
    category: "music",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    duration: 410,
  },
  {
    id: "sh-7",
    name: "Cinematic",
    category: "music",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    duration: 422,
  },
  {
    id: "sh-11",
    name: "Dreamy Piano",
    category: "ambient",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
    duration: 410,
  },
  {
    id: "sh-16",
    name: "Lo-Fi Beats",
    category: "music",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
    duration: 410,
  },
];

/**
 * Fetches a sound from the library by ID
 */
export function getSoundById(id: string): LibrarySound | undefined {
  return SOUND_LIBRARY.find((sound) => sound.id === id);
}

/**
 * Gets all sounds in a specific category
 */
export function getSoundsByCategory(
  category: "music" | "sfx" | "ambient"
): LibrarySound[] {
  return SOUND_LIBRARY.filter((sound) => sound.category === category);
}

/**
 * Fetches the actual audio data from a sound URL with error handling
 */
export async function fetchSoundData(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "audio/mpeg, audio/wav, audio/webm",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sound: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("audio")) {
      console.warn(`Unexpected content type: ${contentType}, proceeding anyway`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("Received empty audio data");
    }

    return arrayBuffer;
  } catch (error) {
    console.error(`Error fetching sound from ${url}:`, error);
    throw error;
  }
}

/**
 * Validates that a sound URL is accessible
 */
export async function validateSoundUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error(`Sound URL validation failed for ${url}:`, error);
    return false;
  }
}
