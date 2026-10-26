import { useState } from 'react';
import { COLORS, type Activity } from '../store';
import { displayColor, useTheme } from '../theme';

export const ACTIVITY_FORM_ID = 'activity-form';

const SUGGESTED = [
  '☀️', '🍽️', '🧘', '😴', '☕️', '💊',
  '🏃', '🚿', '📚', '💧', '🛏️', '🍎',
  '🦷', '🐕', '💼', '🎧', '🥗', '⏱️',
];

// Keep only the last typed character so the field holds a single emoji,
// counting multi-codepoint emoji (e.g. 🧘‍♀️) as one.
const lastGrapheme = (v: string) => [...new Intl.Segmenter().segment(v)].at(-1)?.segment ?? '';

export type ActivityDraft = Pick<Activity, 'name' | 'emoji' | 'color'>;

export default function ActivityForm({ initial, onSave, onDelete, onValidChange }: {
  initial: ActivityDraft;
  onSave: (v: ActivityDraft) => void;
  onDelete?: () => void;
  onValidChange?: (valid: boolean) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [color, setColor] = useState(initial.color);
  const { theme } = useTheme();
  const shown = displayColor(color, theme);

  return (
    <form
      id={ACTIVITY_FORM_ID}
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave({ name: name.trim(), emoji: emoji.trim() || '⏱️', color });
      }}
    >
      <div className="group identity">
        <label className="emoji-well" style={{ background: shown }}>
          <input
            value={emoji} aria-label="Icon"
            onChange={(e) => setEmoji(lastGrapheme(e.target.value))}
          />
        </label>
        <input
          className="name-field" value={name} placeholder="Activity Name" aria-label="Name"
          autoFocus={!initial.name} enterKeyHint="done" maxLength={40}
          onChange={(e) => {
            setName(e.target.value);
            onValidChange?.(e.target.value.trim().length > 0);
          }}
        />
      </div>

      <div className="group picker-grid">
        {COLORS.map((c) => (
          <button
            type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`}
            style={{ '--sw': displayColor(c, theme) } as React.CSSProperties}
            onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={c === color}
          />
        ))}
      </div>

      <div className="group picker-grid">
        {SUGGESTED.map((e) => (
          <button
            type="button" key={e} className={`emoji-option ${e === emoji ? 'on' : ''}`}
            style={{ '--sw': shown } as React.CSSProperties}
            onClick={() => setEmoji(e)} aria-label={`Icon ${e}`} aria-pressed={e === emoji}
          >
            {e}
          </button>
        ))}
      </div>
      <p className="footnote">Tap the circle to use any emoji from your keyboard.</p>

      {onDelete && (
        <div className="group">
          <button type="button" className="row destructive" onClick={onDelete}>Delete Activity</button>
        </div>
      )}
    </form>
  );
}
