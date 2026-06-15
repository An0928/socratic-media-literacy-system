import Image from "next/image"
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react"
import type { Post } from "@/lib/study-data"

export function InstagramPost({ post }: { post: Post }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: post.avatarColor }}
        >
          {post.username.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-card-foreground">{post.username}</p>
          <p className="truncate text-xs text-muted-foreground">@{post.handle}</p>
        </div>
        <MoreHorizontal className="size-5 text-muted-foreground" aria-hidden="true" />
      </header>

      {/* Image */}
      <div className="relative aspect-square w-full bg-muted">
        <Image
          src={post.image || "/placeholder.svg"}
          alt={`${post.username} 的貼文圖片`}
          fill
          sizes="(max-width: 768px) 100vw, 40vw"
          className="object-cover"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <Heart className="size-6 text-card-foreground" aria-hidden="true" />
        <MessageCircle className="size-6 text-card-foreground" aria-hidden="true" />
        <Send className="size-6 text-card-foreground" aria-hidden="true" />
        <Bookmark className="ml-auto size-6 text-card-foreground" aria-hidden="true" />
      </div>

      {/* Likes + caption */}
      <div className="space-y-1 px-4 pb-4 pt-2">
        <p className="text-sm font-bold text-card-foreground">
          {post.likes.toLocaleString("zh-TW")} 個讚
        </p>
        <p className="text-sm leading-relaxed text-card-foreground">
          <span className="font-bold">{post.username}</span>{" "}
          <span className="text-pretty">{post.caption}</span>
        </p>
      </div>
    </article>
  )
}
