import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import { Button, Field, Form, KindBadge, Select, TextInput } from '../../components/ui.tsx'
import type { Exercise, ExerciseType, Topic, TopicKind, VocabWord } from '../../types.ts'

type McDraft = { prompt: string; options: string[]; correct: number }
type FillDraft = { prompt: string; answer: string; hint: string }
type CardDraft = { front: string; back: string; hint: string }

const emptyMc = (): McDraft => ({ prompt: '', options: ['', ''], correct: 0 })
const emptyFill = (): FillDraft => ({ prompt: '', answer: '', hint: '' })
const emptyCard = (): CardDraft => ({ front: '', back: '', hint: '' })

export function CatalogPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [topicTitle, setTopicTitle] = useState('')
  const [topicKind, setTopicKind] = useState<TopicKind>('GRAMMAR')
  const [exTitle, setExTitle] = useState('')
  const [exPrompt, setExPrompt] = useState('')
  const [exTopic, setExTopic] = useState('')
  const [exType, setExType] = useState<ExerciseType>('MULTIPLE_CHOICE')
  const [mcItems, setMcItems] = useState<McDraft[]>([emptyMc()])
  const [fillItems, setFillItems] = useState<FillDraft[]>([emptyFill()])
  const [cards, setCards] = useState<CardDraft[]>([emptyCard()])
  const [error, setError] = useState('')
  const [folder, setFolder] = useState('')
  const [words, setWords] = useState<VocabWord[]>([])

  async function load() {
    const [nextTopics, nextExercises] = await Promise.all([
      api<Topic[]>('/catalog/topics'),
      api<Exercise[]>('/catalog/exercises'),
    ])
    setTopics(nextTopics)
    setExercises(nextExercises)
    if (!exTopic && nextTopics[0]) {
      setExTopic(nextTopics[0].id)
      setFolder(nextTopics[0].id)
      setWords(nextTopics[0].words ?? [])
    } else if (folder) {
      setWords(nextTopics.find((topic) => topic.id === folder)?.words ?? [])
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить каталог')
    })
  }, [])

  function payload() {
    if (exType === 'MULTIPLE_CHOICE') {
      return {
        items: mcItems.map((item) => ({
          prompt: item.prompt,
          options: item.options.map((text, optionIndex) => ({
            id: String.fromCharCode(97 + optionIndex),
            text,
            correct: item.correct === optionIndex,
          })),
        })),
      }
    }
    if (exType === 'FILL_BLANK') {
      return { items: fillItems }
    }
    return { cards }
  }

  const visibleExercises = (folder
    ? exercises.filter((exercise) => exercise.topicId === folder)
    : exercises
  ).filter((exercise) => exercise.type !== 'VOCAB_PACK')

  return (
    <div>
      <h1 className="mb-5 text-[24px] font-semibold">Материалы</h1>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="rounded-2xl border border-line bg-paper p-3">
          <div className="px-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Папки
          </div>
          <div className="mt-1 space-y-1">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  setFolder(topic.id)
                  setExTopic(topic.id)
                  setWords(topic.words ?? [])
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                  folder === topic.id ? 'bg-cedar text-white' : 'hover:bg-paper'
                }`}
              >
                <span className="text-[14px] font-medium">{topic.title}</span>
                <span className={`text-[12px] ${folder === topic.id ? 'text-white/80' : 'text-ink-soft'}`}>
                  {topic._count?.exercises ?? 0}
                </span>
              </button>
            ))}
          </div>
          <Form
            className="mt-3 space-y-2 border-t border-line pt-3"
            onSubmit={async () => {
              setError('')
              try {
                await api('/catalog/topics', {
                  method: 'POST',
                  body: JSON.stringify({ title: topicTitle, kind: topicKind, description: '' }),
                })
                setTopicTitle('')
                await load()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Не удалось создать тему')
              }
            }}
          >
            <Field label="Новая папка">
              <TextInput value={topicTitle} onChange={(event) => setTopicTitle(event.target.value)} required />
            </Field>
            <Select
              value={topicKind}
              onChange={(next) => setTopicKind(next as TopicKind)}
              options={[
                { value: 'GRAMMAR', label: 'Грамматика' },
                { value: 'VOCABULARY', label: 'Лексика' },
              ]}
            />
            <Button type="submit" className="w-full">
              Добавить папку
            </Button>
          </Form>
        </div>

        <div className="space-y-4">
          {topics.find((topic) => topic.id === folder)?.kind === 'VOCABULARY' ? (
            <div className="rounded-2xl border border-line bg-paper p-4">
              <h2 className="mb-1 text-[14px] font-semibold">Слова темы</h2>
              <p className="mb-3 text-[13px] text-ink-soft">
                Эти слова пойдут в карточки, тест, письмо, говорение и 네/아니요.
              </p>
              <div className="space-y-2">
                {words.map((word, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <TextInput
                      value={word.ko}
                      placeholder="한국어"
                      onChange={(event) =>
                        setWords((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, ko: event.target.value } : row,
                          ),
                        )
                      }
                    />
                    <TextInput
                      value={word.ru}
                      placeholder="перевод"
                      onChange={(event) =>
                        setWords((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, ru: event.target.value } : row,
                          ),
                        )
                      }
                    />
                    <TextInput
                      value={word.roman ?? ''}
                      placeholder="романизация"
                      onChange={(event) =>
                        setWords((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, roman: event.target.value } : row,
                          ),
                        )
                      }
                    />
                    <Button
                      tone="ghost"
                      onClick={() => setWords((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button tone="ghost" onClick={() => setWords((current) => [...current, { ko: '', ru: '' }])}>
                  Добавить слово
                </Button>
                <Button
                  onClick={async () => {
                    if (!folder) return
                    setError('')
                    try {
                      await api(`/catalog/topics/${folder}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          words: words.filter((word) => word.ko.trim() && word.ru.trim()),
                        }),
                      })
                      await load()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Не удалось сохранить слова')
                    }
                  }}
                >
                  Сохранить слова
                </Button>
              </div>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-line bg-paper">
            {visibleExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div>
                  <div className="text-[15px] font-semibold">{exercise.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-soft">
                    <KindBadge kind={exercise.topic?.kind ?? 'GRAMMAR'} />
                    {exercise.topic?.title} · {exercise.type}
                  </div>
                </div>
                <Button
                  tone="ghost"
                  onClick={async () => {
                    await api(`/catalog/exercises/${exercise.id}`, { method: 'DELETE' })
                    await load()
                  }}
                >
                  Удалить
                </Button>
              </div>
            ))}
            {visibleExercises.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-ink-soft">В этой папке пока пусто.</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="mb-3 text-[14px] font-semibold">Новое упражнение</h2>
        <Form
          className="space-y-4"
          onSubmit={async () => {
            setError('')
            try {
              await api('/catalog/exercises', {
                method: 'POST',
                body: JSON.stringify({
                  title: exTitle,
                  prompt: exPrompt,
                  type: exType,
                  topicId: exTopic,
                  payload: payload(),
                }),
              })
              setExTitle('')
              setExPrompt('')
              setMcItems([emptyMc()])
              setFillItems([emptyFill()])
              setCards([emptyCard()])
              await load()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Не удалось создать упражнение')
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название">
              <TextInput value={exTitle} onChange={(event) => setExTitle(event.target.value)} required />
            </Field>
            <Field label="Тема">
              <Select
                value={exTopic}
                onChange={setExTopic}
                options={topics.map((topic) => ({ value: topic.id, label: topic.title }))}
              />
            </Field>
            <Field label="Тип">
              <Select
                value={exType}
                onChange={(next) => setExType(next as ExerciseType)}
                options={[
                  { value: 'MULTIPLE_CHOICE', label: 'Тест' },
                  { value: 'FILL_BLANK', label: 'Пропуски' },
                  { value: 'FLASHCARDS', label: 'Карточки' },
                ]}
              />
            </Field>
            <Field label="Подсказка ученику">
              <TextInput value={exPrompt} onChange={(event) => setExPrompt(event.target.value)} />
            </Field>
          </div>

          {exType === 'MULTIPLE_CHOICE'
            ? mcItems.map((item, index) => (
                <div key={index} className="rounded-[14px] border border-line p-4">
                  <Field label={`Вопрос ${index + 1}`}>
                    <TextInput
                      value={item.prompt}
                      onChange={(event) =>
                        setMcItems((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, prompt: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <div className="mt-3 grid gap-2">
                    {item.options.map((option, optionIndex) => (
                      <label key={optionIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${index}`}
                          checked={item.correct === optionIndex}
                          onChange={() =>
                            setMcItems((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, correct: optionIndex } : row,
                              ),
                            )
                          }
                        />
                        <TextInput
                          value={option}
                          placeholder={`вариант ${optionIndex + 1}`}
                          onChange={(event) =>
                            setMcItems((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      options: row.options.map((value, idx) =>
                                        idx === optionIndex ? event.target.value : value,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))
            : null}

          {exType === 'FILL_BLANK'
            ? fillItems.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-[14px] border border-line p-4 sm:grid-cols-3">
                  <Field label="Предложение">
                    <TextInput
                      value={item.prompt}
                      onChange={(event) =>
                        setFillItems((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, prompt: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Ответ">
                    <TextInput
                      value={item.answer}
                      onChange={(event) =>
                        setFillItems((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, answer: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Подсказка">
                    <TextInput
                      value={item.hint}
                      onChange={(event) =>
                        setFillItems((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, hint: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              ))
            : null}

          {exType === 'FLASHCARDS'
            ? cards.map((card, index) => (
                <div key={index} className="grid gap-3 rounded-[14px] border border-line p-4 sm:grid-cols-3">
                  <Field label="Лицо">
                    <TextInput
                      value={card.front}
                      onChange={(event) =>
                        setCards((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, front: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Оборот">
                    <TextInput
                      value={card.back}
                      onChange={(event) =>
                        setCards((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, back: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Романизация">
                    <TextInput
                      value={card.hint}
                      onChange={(event) =>
                        setCards((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, hint: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              ))
            : null}

          <div className="flex flex-wrap gap-3">
            <Button
              tone="ghost"
              onClick={() => {
                if (exType === 'MULTIPLE_CHOICE') setMcItems((current) => [...current, emptyMc()])
                if (exType === 'FILL_BLANK') setFillItems((current) => [...current, emptyFill()])
                if (exType === 'FLASHCARDS') setCards((current) => [...current, emptyCard()])
              }}
            >
              Добавить пункт
            </Button>
            <Button type="submit">Сохранить упражнение</Button>
          </div>
        </Form>
        {error ? <p className="text-seal">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
