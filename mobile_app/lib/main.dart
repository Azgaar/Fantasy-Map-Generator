import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  runApp(const MapApp());
}

class MapApp extends StatelessWidget {
  const MapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fantasy Map Engine',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const MapScreen(),
    );
  }
}

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late final WebViewController _controller;
  double _waterLevel = 0.2;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (String url) {
            setState(() {
              _ready = true;
            });
          },
          onWebResourceError: (WebResourceError error) {
            print('WebResourceError: ${error.description}');
          },
        ),
      )
      ..loadFlutterAsset('assets/www/engine/engine.html');
  }

  void _updateWaterLevel(double value) {
    setState(() {
      _waterLevel = value;
    });

    // Bridge call
    if (_ready) {
      _controller.runJavaScript("window.MapController.setWaterLevel($value)");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // WebGL Map Layer
          WebViewWidget(controller: _controller),

          // UI Overlay
          Positioned(
            bottom: 30,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.6),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    "Water Level",
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  Slider(
                    value: _waterLevel,
                    min: 0.0,
                    max: 1.0,
                    activeColor: Colors.blue,
                    onChanged: _updateWaterLevel,
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      ElevatedButton(
                        onPressed: () {
                          _controller.runJavaScript("window.MapController.rebuildMap('${DateTime.now().millisecondsSinceEpoch}')");
                        },
                        child: const Text("Rebuild"),
                      ),
                    ],
                  )
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
