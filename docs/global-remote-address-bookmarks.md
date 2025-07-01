# Global Remote Address Bookmarks

This feature allows users to create remote address bookmarks that can be accessed from any remote session, regardless of the host.

## Feature Overview

### Before
- Remote address bookmarks were host-specific
- Each server maintained its own separate list of address bookmarks
- Users couldn't access the same bookmarks across different connections

### After
- Users can choose between "Host-specific" and "Global" remote bookmarks
- Global remote bookmarks appear in all remote sessions
- Backward compatibility maintained with existing host-specific bookmarks

## How to Use

### Creating Global Remote Bookmarks

1. Connect to any remote server via SFTP
2. Navigate to the desired directory in the remote file panel
3. Click the star (★) icon to open the address bookmark popover
4. **Toggle Switch**: You'll see a toggle switch labeled "Host-specific" / "Global"
5. **Switch to Global**: Toggle the switch to "Global" mode
6. **Add Bookmark**: Click the plus (+) icon to add the current path as a global bookmark

### Using Global Remote Bookmarks

1. Global bookmarks appear in the bookmark list when the toggle is set to "Global"
2. These bookmarks are available in **all remote sessions** regardless of host
3. Click any global bookmark to navigate to that path (if it exists on the current host)

### Managing Bookmarks

- **Host-specific mode**: Shows only bookmarks for the current host (existing behavior)
- **Global mode**: Shows all global remote bookmarks
- **Delete**: Click the X icon next to any bookmark to delete it
- **Reorder**: Drag and drop bookmarks to reorder them

## Technical Implementation

### Data Structure

```javascript
// Local bookmark (unchanged)
{
  addr: "/local/path",
  host: "",
  id: "unique-id"
}

// Host-specific remote bookmark (unchanged)
{
  addr: "/remote/path", 
  host: "server1.example.com",
  id: "unique-id"
}

// Global remote bookmark (new)
{
  addr: "/remote/path",
  host: "server1.example.com", // Host where it was created
  isGlobal: true,
  id: "unique-id"
}
```

### Storage

- **Local bookmarks**: `localStorage['local-addr-bookmark-keys']`
- **Host-specific bookmarks**: In-memory, synced with server
- **Global bookmarks**: `localStorage['global-addr-bookmark-keys']`

## Backward Compatibility

- Existing host-specific bookmarks continue to work unchanged
- No migration required
- Users can gradually adopt global bookmarks as needed
- Toggle defaults to "Host-specific" mode to preserve existing behavior

## Use Cases

1. **Development environments**: Access common paths like `/var/log`, `/etc`, `/home/user` across multiple servers
2. **System administration**: Quick access to standard directories across server fleet
3. **File management**: Bookmark frequently accessed project directories that exist on multiple hosts
4. **Deployment workflows**: Access common deployment paths across staging/production servers

## UI Components

- **Toggle Switch**: Small switch in bookmark popover header for remote sessions only
- **Visual indicator**: "Host-specific" vs "Global" label shows current mode
- **Consistent styling**: Matches existing Electerm UI patterns
- **Responsive design**: Works with existing drag/drop and context menus