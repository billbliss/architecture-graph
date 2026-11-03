# Task manager requirements

People keep personal and shared task lists. A task has a title, optional notes, an optional due time, a list, an optional assignee, and a completion state. People use a web app, a mobile app, or a command-line tool, and all three show the same tasks.

## Tasks

The task service is the only part of the system that changes task state. Every other part asks it to make a change. After a change is saved, the service announces it as a task-changed event so other parts can react. Consumers must tolerate receiving the same event more than once.

A task can repeat (for example, "every Monday"). Recurrence rules expand into due times. How repeating tasks are stored is still open: one record that moves forward, or one record per occurrence.

When the service returns a task, it includes the time of the task's next reminder, which it gets from reminders. This means tasks and reminders depend on each other.

## Reminders

A person can ask to be reminded before a task is due. The reminder scheduler listens for task changes, schedules reminders, and announces a reminder-due event when one fires. Snoozing a reminder moves the task's due time, which the scheduler asks the task service to do.

A completed or deleted task never fires a reminder, even if the completion arrives just before the reminder was due to fire.

Whether reminders fire on a phone that is offline is still open.

## Offline sync

The mobile app works offline. Edits made offline wait in an on-device queue and are sent as a change set when the device reconnects. The sync engine applies change sets through the task service and pushes other people's changes back to the device.

Offline edits must never be silently lost. When two devices edit the same task, how to resolve the conflict is still open: the last write wins, or edits are merged field by field.

## Notifications and search

Notifications tell a person when a reminder fires or when someone assigns them a task. Search keeps a searchable copy of tasks up to date from task-changed events. Search results can lag behind recent edits by a few seconds.

## Out of scope

Accounts, billing, and file attachments are not part of this design.
