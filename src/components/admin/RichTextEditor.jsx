"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Pilcrow,
  Code,
} from "lucide-react";

function ToolbarButton({ onClick, active, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-primary text-white"
          : "text-ink hover:bg-primary/5 disabled:opacity-30"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value = "", onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-slate max-w-none px-4 py-3 min-h-[180px] focus:outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
  });

  // Sync external value changes (e.g. switching between products) into the editor.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="border border-line rounded-xl min-h-[220px] animate-pulse bg-primary/5" />
    );
  }

  function setLink() {
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }

  function addImage() {
    const url = window.prompt("Image URL");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }

  return (
    <div className="border border-line rounded-xl overflow-hidden bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-line bg-surface">
        <ToolbarButton
          label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={15} />
        </ToolbarButton>

        <span className="w-px h-5 bg-line mx-1" />

        <ToolbarButton
          label="Paragraph"
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={15} />
        </ToolbarButton>

        <span className="w-px h-5 bg-line mx-1" />

        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={15} />
        </ToolbarButton>

        <span className="w-px h-5 bg-line mx-1" />

        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Ordered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={15} />
        </ToolbarButton>

        <span className="w-px h-5 bg-line mx-1" />

        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={setLink}
        >
          <LinkIcon size={15} />
        </ToolbarButton>
        <ToolbarButton label="Insert image" onClick={addImage}>
          <ImageIcon size={15} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
