import { defineCollection, z } from 'astro:content'

const episodes = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      twitchUrl: z.string(),
      thumbnail: image(),
      youtubeUrl: z.string().optional(),
    }),
})

export const collections = {
  episodes,
}
