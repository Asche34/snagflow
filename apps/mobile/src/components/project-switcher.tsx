import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../providers/auth';
import { listActiveProjects } from '../lib/data';
import { useResource } from '../lib/use-resource';
import { Button, colours, ErrorText, Loading, styles } from './ui';

export function ProjectSwitcher({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch project"
        aria-expanded={open}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[menu.trigger, { opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={menu.triggerText}>☰ Projects</Text>
      </Pressable>
      {open && <ProjectMenu key={pathname} pathname={pathname} close={() => setOpen(false)} />}
    </>
  );
}

function ProjectMenu({ pathname, close }: { pathname: string; close: () => void }) {
  const { client, session } = useAuth();
  const currentId = /^\/projects\/([^/]+)/.exec(pathname)?.[1];
  const projects = useResource(
    () => listActiveProjects(client),
    `project-menu:${session!.user.id}`,
    ['projects', 'project_members'],
  );
  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={menu.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss project menu"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
        <SafeAreaView style={menu.panel} accessibilityViewIsModal>
          <View style={menu.header}>
            <Text accessibilityRole="header" style={styles.heading}>
              Projects
            </Text>
            <Button label="Close project menu" secondary onPress={close} />
          </View>
          <ScrollView contentContainerStyle={menu.content}>
            <ErrorText error={projects.error} />
            {projects.error && (
              <Button label="Retry projects" onPress={() => void projects.refresh()} />
            )}
            {projects.loading && !projects.data && <Loading />}
            {projects.data?.map((project) => (
              <Pressable
                key={project.id}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${project.name}`}
                accessibilityState={{ selected: project.id === currentId }}
                onPress={() => {
                  close();
                  if (project.id !== currentId || pathname !== `/projects/${project.id}`)
                    router.replace({ pathname: '/projects/[id]', params: { id: project.id } });
                }}
                style={({ pressed }) => [
                  styles.card,
                  project.id === currentId && menu.selected,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={styles.muted}>{project.code}</Text>
                <Text style={styles.title}>{project.name}</Text>
                {project.id === currentId && <Text style={menu.current}>Current project</Text>}
              </Pressable>
            ))}
            {projects.data?.length === 0 && (
              <Text style={styles.muted}>No active projects available.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const menu = StyleSheet.create({
  trigger: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  triggerText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'flex-start' },
  panel: { flex: 1, width: '88%', maxWidth: 360, backgroundColor: colours.background },
  header: { padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: colours.border },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  selected: { borderColor: colours.primary, backgroundColor: '#fff1e8' },
  current: { color: colours.primary, fontSize: 16, fontWeight: '600' },
});
