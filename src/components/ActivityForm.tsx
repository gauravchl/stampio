import { useState } from 'react';
import { COLORS, type Activity } from '../store';
import { displayColor, useTheme } from '../theme';

// Keep only the last typed character so the field holds a single emoji,
// counting multi-codepoint emoji (e.g. 🧘‍♀️) as one.
const lastGrapheme = (v: string) => [...new Intl.Segmenter().segment(v)].at(-1)?.segment ?? '';

export default function ActivityForm({ initial, onSave, onDelete }: {
  initial: Pick<Activity, 'name' | 'emoji' | 'color'>;
  onSave: (v: Pick<Activity, 'name' | 'emoji' | 'color'>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [color, setColor] = useState(initial.color);
  const valid = name.trim().length > 0;
  const { theme } = useTheme();

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ name: name.trim(), emoji: emoji.trim() || '⏱️', color });
      }}
    >
      <div className="row">
        <label className="field emoji-field">
          <span>Icon</span>
          <input value={emoji} onChange={(e) => setEmoji(lastGrapheme(e.target.value))} placeholder="⏱️" />
        </label>
        <label className="field grow">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee" autoFocus={!initial.name} />
        </label>
      </div>
      <div className="field">
        <span>Color</span>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`}
              style={{ background: displayColor(c, theme) }} onClick={() => setColor(c)} aria-label={c}
            />
          ))}
        </div>
      </div>
      <button className="primary" type="submit" disabled={!valid}>Save</button>
      {onDelete && (
        <button type="button" className="danger" onClick={onDelete}>Delete activity</button>
      )}
    </form>
  );
}
