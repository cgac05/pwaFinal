# 🔧 SETUP PERMANENTE - PowerShell PATH Configuration
**Objetivo:** Hacer permanente la configuración de PATH para SpecKit

---

## Opción 1: Configurar PowerShell Profile (RECOMENDADO)

### Paso 1: Abrir o crear el PowerShell Profile
```powershell
# Verificar si existe el profile
Test-Path $PROFILE

# Si no existe o quieres editarlo:
notepad $PROFILE
```

### Paso 2: Agregar línea al Profile
Copiar y pegar esta línea al archivo que se abrió:
```powershell
# SpecKit PATH Configuration
$env:PATH = "C:\Users\guill\.local\bin;$env:PATH"
```

### Paso 3: Guardar y cerrar
- Guardar con `Ctrl+S`
- Cerrar el editor

### Paso 4: Recargar PowerShell
```powershell
# Opción 1: Cerrar y abrir una nueva ventana de PowerShell

# Opción 2: Recargar el profile
. $PROFILE
```

### Paso 5: Verificar
```powershell
specify version

# Debería mostrar: SpecKit CLI v0.8.12.dev0
```

---

## Opción 2: Agregar a Variables de Entorno (Sistema)

### Para Windows (Permanentemente para todo usuario)

1. Presionar `Windows Key + X` y seleccionar "System"
2. Click en "Advanced system settings"
3. Click en botón "Environment Variables"
4. En "User variables" o "System variables", click "New"
5. Rellenar:
   - **Variable name:** PATH (o agregar a PATH existente)
   - **Variable value:** C:\Users\guill\.local\bin
6. Click OK en todos los diálogos
7. Reiniciar PowerShell

---

## Verificación

Después de cualquier opción, verificar en una **nueva ventana** de PowerShell:

```powershell
# Verificar que specify está en el PATH
where specify

# Debería mostrar: C:\Users\guill\.local\bin\specify.exe

# Verificar funcionamiento
specify version
```

---

## Solución de Problemas

### Si sigue sin funcionar:
```powershell
# Ver contenido actual del PATH
$env:PATH -split ';'

# Verificar que el archivo existe
Test-Path "C:\Users\guill\.local\bin\specify.exe"

# Intenta la ruta completa si es necesario
C:\Users\guill\.local\bin\specify version
```

### Si hay errores de permisos:
```powershell
# Ejecutar PowerShell como administrador
# Luego ejecutar:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## RESUMEN

✅ **Método Recomendado:** Opción 1 (PowerShell Profile)
- Es más fácil de mantener
- Específico para tu usuario
- Se aplica automáticamente al abrir PowerShell

⚠️ **Nota:** Si necesitas que esté disponible en todas las aplicaciones (no solo PowerShell), usa Opción 2

---

**Una vez configurado, ya no necesitarás ejecutar:**
```powershell
$env:PATH = "C:\Users\guill\.local\bin;$env:PATH"
```

**Podrás usar directamente:**
```powershell
specify version
```
