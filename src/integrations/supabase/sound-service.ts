// Supabase Sound Management Service
// Handles fetching, storing, and managing pre-given sounds and user uploads

import { supabase } from "./client";
import { supabaseAdmin } from "./client.server";
import type { LibrarySound } from "../../lib/sound-library";

const SOUNDS_BUCKET = "sounds";
const SOUNDS_FOLDER = "library"; // For pre-given sounds

/**
 * Initializes the sounds bucket and ensures it exists with proper permissions
 * Run this once during app startup
 */
export async function initializeSoundsBucket(): Promise<void> {
  try {
    // Check if bucket exists by trying to list it
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const soundsBucketExists = buckets?.some((b) => b.name === SOUNDS_BUCKET);

    if (!soundsBucketExists) {
      console.log("Creating sounds bucket...");
      await supabaseAdmin.storage.createBucket(SOUNDS_BUCKET, {
        public: true,
        fileSizeLimit: 524288000, // 500MB limit
        allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/webm", "audio/ogg"],
      });
      console.log("✓ Sounds bucket created successfully");
    }
  } catch (error) {
    // Bucket might already exist, continue
    console.warn("Sounds bucket initialization:", error);
  }
}

/**
 * Gets the public URL for a sound file in Supabase Storage
 */
export function getSoundStorageUrl(soundPath: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  return `${supabaseUrl}/storage/v1/object/public/${SOUNDS_BUCKET}/${soundPath}`;
}

/**
 * Fetches a pre-given sound from Supabase Storage
 */
export async function fetchLibrarySound(
  soundId: string
): Promise<ArrayBuffer> {
  try {
    const { data, error } = await supabase.storage
      .from(SOUNDS_BUCKET)
      .download(`${SOUNDS_FOLDER}/${soundId}`);

    if (error) {
      throw new Error(`Failed to download sound: ${error.message}`);
    }

    if (!data) {
      throw new Error("No data received from storage");
    }

    return await data.arrayBuffer();
  } catch (error) {
    console.error(`Error fetching library sound ${soundId}:`, error);
    throw error;
  }
}

/**
 * Uploads a user-provided sound file to Supabase Storage
 */
export async function uploadUserSound(
  file: File,
  userId: string
): Promise<{ path: string; url: string }> {
  try {
    // Validate file
    if (!file.type.startsWith("audio/")) {
      throw new Error("File must be an audio file");
    }

    if (file.size > 524288000) {
      // 500MB
      throw new Error("File size exceeds 500MB limit");
    }

    const fileName = `${userId}/${Date.now()}_${sanitizeFilename(file.name)}`;
    const { data, error } = await supabase.storage
      .from(SOUNDS_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data) {
      throw new Error("No data returned from upload");
    }

    const url = getSoundStorageUrl(data.path);
    return { path: data.path, url };
  } catch (error) {
    console.error("Error uploading sound:", error);
    throw error;
  }
}

/**
 * Deletes a user-uploaded sound from Supabase Storage
 */
export async function deleteUserSound(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(SOUNDS_BUCKET)
      .remove([path]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting sound:", error);
    throw error;
  }
}

/**
 * Lists all user-uploaded sounds for a specific user
 */
export async function listUserSounds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(SOUNDS_BUCKET)
      .list(`${userId}`, {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      throw new Error(`List failed: ${error.message}`);
    }

    return (data || []).map((file) => `${userId}/${file.name}`);
  } catch (error) {
    console.error("Error listing user sounds:", error);
    throw error;
  }
}

/**
 * Gets metadata for sounds stored in media_files table
 */
export async function getSoundMetadata(mediaFileId: string) {
  try {
    const { data, error } = await supabase
      .from("media_files")
      .select("*")
      .eq("id", mediaFileId)
      .eq("kind", "audio")
      .single();

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error fetching sound metadata:", error);
    throw error;
  }
}

/**
 * Saves sound metadata to media_files table
 */
export async function saveSoundMetadata(metadata: {
  name: string;
  storage_path: string;
  duration_seconds?: number;
  size_bytes?: number;
  mime_type?: string;
  project_id?: string;
}): Promise<any> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase.from("media_files").insert({
      user_id: session.session.user.id,
      kind: "audio",
      ...metadata,
    });

    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error saving sound metadata:", error);
    throw error;
  }
}

/**
 * Helper function to sanitize filenames
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 255);
}

/**
 * Helper to convert LibrarySound to a fetchable sound URL
 */
export function getLibrarySoundUrl(sound: LibrarySound): string {
  // Check if it's a pre-stored library sound or external URL
  if (sound.url.includes("soundhelix.com")) {
    return sound.url; // Return external URL directly
  }
  // If stored in our bucket, construct the path
  return getSoundStorageUrl(`${SOUNDS_FOLDER}/${sound.id}`);
}
