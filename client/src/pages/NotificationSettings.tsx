import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Plus, Edit, Trash2, Send, FileText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotificationSetting {
  id: string;
  name: string;
  type: 'expiring_soon' | 'expired';
  daysBeforeExpiry: number | null;
  targetRoles: string[];
  isEnabled: boolean;
  emailSubject: string;
  emailBody: string;
}

interface NotificationLog {
  id: string;
  settingId: string;
  recipientId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed';
  errorMessage: string | null;
  sentAt: string;
}

const USER_ROLES = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'assessor', label: 'Assessor' },
  { value: 'verifier', label: 'Verifier' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

const DEFAULT_EMAIL_TEMPLATES = {
  expiring_soon: {
    subject: 'Your Competencies are Expiring Soon',
    body: `<p>Dear {{userName}},</p>
<p>This is a reminder that the following competencies are expiring soon:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Competency</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Status</th>
    </tr>
  </thead>
  <tbody>
    {{competencies}}
  </tbody>
</table>
<p>Please contact your assessor to schedule reassessment.</p>
<p>Best regards,<br>Capera Team</p>`
  },
  expired: {
    subject: 'Your Competencies Have Expired',
    body: `<p>Dear {{userName}},</p>
<p>The following competencies have expired:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Competency</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Status</th>
    </tr>
  </thead>
  <tbody>
    {{competencies}}
  </tbody>
</table>
<p>Please contact your assessor to schedule reassessment as soon as possible.</p>
<p>Best regards,<br>Capera Team</p>`
  }
};

export default function NotificationSettings() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<NotificationSetting | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'expiring_soon' as 'expiring_soon' | 'expired',
    daysBeforeExpiry: 30,
    targetRoles: [] as string[],
    isEnabled: true,
    emailSubject: DEFAULT_EMAIL_TEMPLATES.expiring_soon.subject,
    emailBody: DEFAULT_EMAIL_TEMPLATES.expiring_soon.body,
  });

  // Fetch notification settings
  const { data: settings = [], isLoading: settingsLoading } = useQuery<NotificationSetting[]>({
    queryKey: ['/api/admin/notification-settings'],
  });

  // Fetch notification logs
  const { data: logs = [], isLoading: logsLoading } = useQuery<NotificationLog[]>({
    queryKey: ['/api/admin/notification-logs'],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('POST', '/api/admin/notification-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notification-settings'] });
      toast({
        title: 'Notification Setting Created',
        description: 'The notification setting has been created successfully',
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create notification setting',
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return await apiRequest('PUT', `/api/admin/notification-settings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notification-settings'] });
      toast({
        title: 'Notification Setting Updated',
        description: 'The notification setting has been updated successfully',
      });
      setEditingSetting(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update notification setting',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/admin/notification-settings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notification-settings'] });
      toast({
        title: 'Notification Setting Deleted',
        description: 'The notification setting has been deleted successfully',
      });
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete notification setting',
        variant: 'destructive',
      });
    },
  });

  // Send now mutation
  const sendNowMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/notifications/send-now');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notification-logs'] });
      toast({
        title: 'Notifications Sent',
        description: `Successfully sent ${data.totalSent || 0} notification(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Send Failed',
        description: error.message || 'Failed to send notifications',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'expiring_soon',
      daysBeforeExpiry: 30,
      targetRoles: [],
      isEnabled: true,
      emailSubject: DEFAULT_EMAIL_TEMPLATES.expiring_soon.subject,
      emailBody: DEFAULT_EMAIL_TEMPLATES.expiring_soon.body,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (setting: NotificationSetting) => {
    setFormData({
      name: setting.name,
      type: setting.type,
      daysBeforeExpiry: setting.daysBeforeExpiry || 30,
      targetRoles: setting.targetRoles,
      isEnabled: setting.isEnabled,
      emailSubject: setting.emailSubject,
      emailBody: setting.emailBody,
    });
    setEditingSetting(setting);
  };

  const handleSubmit = () => {
    if (!formData.name || formData.targetRoles.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (editingSetting) {
      updateMutation.mutate({ id: editingSetting.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role]
    }));
  };

  const handleTypeChange = (type: 'expiring_soon' | 'expired') => {
    setFormData(prev => ({
      ...prev,
      type,
      emailSubject: DEFAULT_EMAIL_TEMPLATES[type].subject,
      emailBody: DEFAULT_EMAIL_TEMPLATES[type].body,
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Email Notifications</h1>
          <p className="text-muted-foreground">Configure automated email notifications for competency expiry</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => sendNowMutation.mutate()}
            disabled={sendNowMutation.isPending}
            variant="outline"
            data-testid="button-send-now"
          >
            {sendNowMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Now
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-setting">
            <Plus className="h-4 w-4" />
            Create Setting
          </Button>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList data-testid="tabs-notification-sections">
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Bell className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          {settingsLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center" data-testid="loading-settings">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : settings.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground" data-testid="text-no-settings">
                  No notification settings configured. Click "Create Setting" to add one.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {settings.map((setting) => (
                <Card key={setting.id} data-testid={`card-setting-${setting.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {setting.name}
                          <Badge variant={setting.isEnabled ? 'default' : 'secondary'} data-testid={`badge-status-${setting.id}`}>
                            {setting.isEnabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          <Badge variant="outline" data-testid={`badge-type-${setting.id}`}>
                            {setting.type === 'expiring_soon' ? 'Expiring Soon' : 'Expired'}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {setting.type === 'expiring_soon' && setting.daysBeforeExpiry && (
                            <span>Sends {setting.daysBeforeExpiry} days before expiry</span>
                          )}
                          {setting.type === 'expired' && <span>Sends when competencies have expired</span>}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(setting)}
                          data-testid={`button-edit-${setting.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(setting.id)}
                          data-testid={`button-delete-${setting.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium">Target Roles: </span>
                        <span className="text-sm text-muted-foreground">
                          {setting.targetRoles.map(role => 
                            USER_ROLES.find(r => r.value === role)?.label || role
                          ).join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Email Subject: </span>
                        <span className="text-sm text-muted-foreground">{setting.emailSubject}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {logsLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center" data-testid="loading-logs">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground" data-testid="text-no-logs">
                  No notification logs yet. Click "Send Now" to trigger notifications.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Card key={log.id} data-testid={`card-log-${log.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} data-testid={`badge-log-status-${log.id}`}>
                            {log.status}
                          </Badge>
                          <span className="font-medium">{log.recipientEmail}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.subject}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.sentAt).toLocaleString()}
                        </div>
                        {log.errorMessage && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertDescription>{log.errorMessage}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || !!editingSetting} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setEditingSetting(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-setting-form">
          <DialogHeader>
            <DialogTitle>
              {editingSetting ? 'Edit Notification Setting' : 'Create Notification Setting'}
            </DialogTitle>
            <DialogDescription>
              Configure when and who receives email notifications about expiring competencies
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Setting Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 30 Day Warning for Candidates"
                data-testid="input-setting-name"
              />
            </div>

            <div>
              <Label htmlFor="type">Notification Type *</Label>
              <Select value={formData.type} onValueChange={(value) => handleTypeChange(value as 'expiring_soon' | 'expired')}>
                <SelectTrigger data-testid="select-notification-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'expiring_soon' && (
              <div>
                <Label htmlFor="days">Days Before Expiry *</Label>
                <Input
                  id="days"
                  type="number"
                  value={formData.daysBeforeExpiry}
                  onChange={(e) => setFormData({ ...formData, daysBeforeExpiry: parseInt(e.target.value) || 30 })}
                  placeholder="30"
                  data-testid="input-days-before-expiry"
                />
              </div>
            )}

            <div>
              <Label>Target Roles * (select at least one)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {USER_ROLES.map((role) => (
                  <div key={role.value} className="flex items-center gap-2">
                    <Switch
                      checked={formData.targetRoles.includes(role.value)}
                      onCheckedChange={() => toggleRole(role.value)}
                      data-testid={`switch-role-${role.value}`}
                    />
                    <Label className="cursor-pointer">{role.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                data-testid="switch-enabled"
              />
              <Label>Enabled</Label>
            </div>

            <div>
              <Label htmlFor="subject">Email Subject *</Label>
              <Input
                id="subject"
                value={formData.emailSubject}
                onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                placeholder="Your Competencies are Expiring Soon"
                data-testid="input-email-subject"
              />
            </div>

            <div>
              <Label htmlFor="body">Email Body (HTML) *</Label>
              <div className="text-xs text-muted-foreground mb-2">
                Use {'{{userName}}'} for recipient name and {'{{competencies}}'} for competency list
              </div>
              <Textarea
                id="body"
                value={formData.emailBody}
                onChange={(e) => setFormData({ ...formData, emailBody: e.target.value })}
                placeholder="Email body HTML..."
                className="font-mono text-sm min-h-[200px]"
                data-testid="textarea-email-body"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingSetting(null);
                resetForm();
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editingSetting ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete Notification Setting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this notification setting? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
