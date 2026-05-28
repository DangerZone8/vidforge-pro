// Hook to manage sound library and fetch pre-given sounds
import { useEffect, useState } from "react";
import { SOUND_LIBRARY, fetchSoundData } from "@/lib/sound-library";
import { getLibrarySoundUrl } from "@/integrations/supabase/sound-service";
import type { LibrarySound } from "@/lib/sound-library";

interface SoundState {
  availableSounds: LibrarySound[];
  loading: boolean;
  error: string | null;
  cachedAudio: Map<string, AudioBuffer>;
}

/**
 * Hook to load and cache pre-given sounds from the library
 */
export function useLibrarySounds() {
  const [state, setState] = useState<SoundState>({
    availableSounds: SOUND_LIBRARY,
    loading: false,
    error: null,
    cachedAudio: new Map(),
  });

  /**
   * Fetch and cache a sound's audio data
   */
  const loadSound = async (sound: LibrarySound): Promise<AudioBuffer> => {
    // Return from cache if available
    if (state.cachedAudio.has(sound.id)) {
      return state.cachedAudio.get(sound.id)!;
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const url = getLibrarySoundUrl(sound);
      const arrayBuffer = await fetchSoundData(url);

      // Decode to AudioBuffer for immediate playback
      const audioContext =
        new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Cache the decoded audio
      setState((prev) => {
        const newCache = new Map(prev.cachedAudio);
        newCache.set(sound.id, audioBuffer);
        return { ...prev, cachedAudio: newCache, loading: false };
      });

      return audioBuffer;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setState((prev) => ({ ...prev, error: errorMsg, loading: false }));
      throw error;
    }
  };

  /**
   * Validate all sounds in the library are accessible
   */
  const validateAllSounds = async (): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const results = await Promise.allSettled(
        SOUND_LIBRARY.map((sound) => fetchSoundData(getLibrarySoundUrl(sound)))
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const errorMsg = `${failed.length}/${SOUND_LIBRARY.length} sounds failed to load`;
        setState((prev) => ({ ...prev, error: errorMsg, loading: false }));
        return false;
      }

      setState((prev) => ({ ...prev, error: null, loading: false }));
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Validation failed";
      setState((prev) => ({ ...prev, error: errorMsg, loading: false }));
      return false;
    }
  };

  /**
   * Get a specific sound by ID
   */
  const getSound = (id: string): LibrarySound | undefined => {
    return SOUND_LIBRARY.find((s) => s.id === id);
  };

  /**
   * Get sounds by category
   */
  const getSoundsByCategory = (
    category: "music" | "sfx" | "ambient"
  ): LibrarySound[] => {
    return SOUND_LIBRARY.filter((s) => s.category === category);
  };

  return {
    sounds: state.availableSounds,
    loading: state.loading,
    error: state.error,
    loadSound,
    validateAllSounds,
    getSound,
    getSoundsByCategory,
    getCachedAudio: (id: string) => state.cachedAudio.get(id),
  };
}
